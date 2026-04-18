'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WatchEvent } from '@/lib/parser';
import {
  DEFAULT_ROLLING_WINDOW_DAYS,
  DEFAULT_TIMELAPSE_DIMENSION_ID,
  ROLLING_WINDOW_DAY_OPTIONS,
  TIMELAPSE_DIMENSION_PRESETS,
  advanceRollingWindow,
  buildMilestonePrefix,
  buildTimedChannelEvents,
  channelBarColor,
  channelBarColorFromName,
  computeTopChannels,
  countMilestonesAtOrBefore,
  createRollingWindowState,
  getTimelapseDimensionPreset,
  pickWebmMimeType,
  readCounts,
  rollingWindowFileTag,
  rollingWindowLabel,
  rollingWindowMs,
  topNFromCounts,
  type RollingWindowDays,
  type TimelapseDimensionId,
  type TimelapseMode,
} from '@/lib/channel-timelapse';

type Props = {
  sourceEvents: WatchEvent[];
  rangeStart: Date;
  rangeEnd: Date;
};

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
  if (typeof rr.roundRect === 'function') {
    ctx.beginPath();
    rr.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const DURATION_OPTIONS = [
  { value: 10, label: '10 s' },
  { value: 18, label: '18 s' },
  { value: 30, label: '30 s' },
  { value: 60, label: '60 s' },
  { value: 120, label: '120 s' },
  { value: 180, label: '180 s' },
  { value: 300, label: '300 s' },
] as const;

function drawTimelapseFrame(
  ctx: CanvasRenderingContext2D,
  params: {
    timelapseMode: TimelapseMode;
    /** Shown before the date when {@link timelapseMode} is rolling (e.g. "90-day window"). */
    rollingWindowLabel?: string;
    names: string[];
    counts: number[];
    cursorTime: Date;
    rangeStart: Date;
    rangeEnd: Date;
    maxCount: number;
    width: number;
    height: number;
  }
) {
  const {
    timelapseMode,
    rollingWindowLabel: rollingLabel,
    names,
    counts,
    cursorTime,
    rangeStart,
    rangeEnd,
    maxCount,
    width: W,
    height: H,
  } = params;
  const isPortrait = H > W;
  const padX = Math.max(14, Math.round(W * (isPortrait ? 0.046 : 0.044)));
  const padBottom = Math.max(20, Math.round(H * 0.045));
  const titlePx = Math.max(17, Math.round(Math.min(W, H) * (isPortrait ? 0.036 : 0.022)));
  const subPx = Math.max(11, Math.round(titlePx * 0.64));
  const cursorPx = Math.max(11, Math.round(subPx * 0.98));
  const barLabelPx = Math.max(10, Math.round(Math.min(W, H) * (isPortrait ? 0.02 : 0.017)));
  const countPx = Math.max(10, Math.round(barLabelPx * 0.93));
  const cornerR = Math.max(3, Math.round(Math.min(W, H) * 0.0045));

  const titleY = Math.round(H * (isPortrait ? 0.028 : 0.042));
  const metaGap = Math.round(subPx * 1.15);
  const rangeY = titleY + titlePx + Math.round(subPx * 0.25);
  const headerAfterMeta = rangeY + metaGap + (isPortrait ? Math.round(subPx * 0.85) : 0);
  const barsTop = Math.max(headerAfterMeta + Math.round(H * 0.02), Math.round(H * (isPortrait ? 0.14 : 0.13)));
  const innerH = H - barsTop - padBottom;
  const barSlot = innerH / Math.max(1, names.length);
  const barH = Math.max(12, Math.min(isPortrait ? 38 : 44, barSlot * 0.7));
  const gap = barSlot - barH;

  ctx.fillStyle = '#0f1216';
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f4f1ea';
  ctx.font = `600 ${titlePx}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillText('Top channels · timelapse', padX, titleY);

  const rangeLabel = `${rangeStart.toLocaleDateString(undefined, { dateStyle: 'medium' })} → ${rangeEnd.toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
  const cursorStr = cursorTime.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const cursorRight =
    timelapseMode === 'rolling' && rollingLabel
      ? `${rollingLabel} · ${cursorStr}`
      : `Through ${cursorStr}`;

  ctx.fillStyle = 'rgba(244,241,234,0.55)';
  ctx.font = `500 ${subPx}px system-ui, -apple-system, Segoe UI, sans-serif`;
  if (isPortrait) {
    ctx.fillText(rangeLabel, padX, rangeY, Math.max(80, W - 2 * padX));
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(244,241,234,0.85)';
    ctx.font = `600 ${cursorPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(cursorRight, W - padX, titleY, Math.max(60, W - 2 * padX - 8));
    ctx.textAlign = 'left';
  } else {
    ctx.fillText(rangeLabel, padX, rangeY);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(244,241,234,0.85)';
    ctx.font = `600 ${cursorPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(cursorRight, W - padX, rangeY);
    ctx.textAlign = 'left';
  }

  const labelMaxW = Math.max(72, Math.min(isPortrait ? W * 0.36 : W * 0.28, W * 0.42));
  const gutter = Math.max(8, Math.round(W * 0.012));
  const barX0 = padX + labelMaxW + gutter;
  const barW = Math.max(32, W - barX0 - padX);
  const denom = Math.max(maxCount, 1);

  const maxLabelChars = isPortrait ? 22 : 42;
  const ranked = names
    .map((name, channelIndex) => ({ name, channelIndex, count: counts[channelIndex] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  ranked.forEach((row, rank) => {
    const y = barsTop + rank * barSlot + gap / 2;
    const label =
      row.name.length > maxLabelChars ? `${row.name.slice(0, Math.max(8, maxLabelChars - 2))}…` : row.name;
    ctx.fillStyle = 'rgba(244,241,234,0.92)';
    ctx.font = `600 ${barLabelPx}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, padX, y + barH / 2, labelMaxW);

    const frac = row.count / denom;
    const fillW = Math.max(0, barW * frac);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRectPath(ctx, barX0, y, barW, barH, cornerR);
    ctx.fill();

    if (fillW > 0) {
      ctx.fillStyle =
        timelapseMode === 'rolling' ? channelBarColorFromName(row.name) : channelBarColor(row.channelIndex);
      roundRectPath(ctx, barX0, y, fillW, barH, cornerR);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(244,241,234,0.9)';
    ctx.font = `600 ${countPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(String(row.count), barX0 + barW, y + barH / 2);
    ctx.textAlign = 'left';
  });

  const footPx = Math.max(10, Math.round(Math.min(W, H) * 0.014));
  ctx.fillStyle = 'rgba(244,241,234,0.35)';
  ctx.font = `500 ${footPx}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.fillText('ViewPulse · local export · no upload', padX, H - Math.max(10, Math.round(H * 0.022)));
}

export function DashboardVideos({ sourceEvents, rangeStart, rangeEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [durationSec, setDurationSec] = useState<(typeof DURATION_OPTIONS)[number]['value']>(18);
  const [dimensionId, setDimensionId] = useState<TimelapseDimensionId>(DEFAULT_TIMELAPSE_DIMENSION_ID);
  const [timelapseMode, setTimelapseMode] = useState<TimelapseMode>('cumulative');
  const [rollingWindowDays, setRollingWindowDays] = useState<RollingWindowDays>(DEFAULT_ROLLING_WINDOW_DAYS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  const dimensionPreset = useMemo(() => getTimelapseDimensionPreset(dimensionId), [dimensionId]);
  const outW = dimensionPreset.width;
  const outH = dimensionPreset.height;

  const rollingMs = useMemo(() => rollingWindowMs(rollingWindowDays), [rollingWindowDays]);
  const rollingLabelStr = useMemo(() => rollingWindowLabel(rollingWindowDays), [rollingWindowDays]);

  const timedChannelEvents = useMemo(
    () => buildTimedChannelEvents(sourceEvents, rangeStartMs, rangeEndMs, rollingMs),
    [sourceEvents, rangeStartMs, rangeEndMs, rollingMs]
  );

  const { names, times, prefix, maxCount, milestoneCount } = useMemo(() => {
    const top = computeTopChannels(sourceEvents, 10);
    const C = top.names.length;
    if (C === 0) {
      return {
        names: top.names,
        times: new Float64Array(0),
        prefix: new Uint32Array(0),
        maxCount: 0,
        milestoneCount: 0,
      };
    }
    const built = buildMilestonePrefix(sourceEvents, top.channelToIndex, C);
    const counts = new Array<number>(C).fill(0);
    readCounts(built.prefix, C, built.milestoneCount, counts);
    const maxCount = counts.length ? Math.max(...counts) : 0;
    return {
      names: top.names,
      times: built.times,
      prefix: built.prefix,
      maxCount,
      milestoneCount: built.milestoneCount,
    };
  }, [sourceEvents]);

  const countsScratch = useMemo(() => new Array<number>(Math.max(10, names.length)).fill(0), [names.length]);

  /** 0 = range start, 1 = range end — preview playhead */
  const [previewProgress, setPreviewProgress] = useState(1);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewProgressRef = useRef(1);
  previewProgressRef.current = previewProgress;

  const renderCanvasAtProgress = useCallback(
    (u: number) => {
      const canvas = canvasRef.current;
      if (!canvas || names.length === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const span = Math.max(1, rangeEndMs - rangeStartMs);
      const clamped = Math.max(0, Math.min(1, u));
      const T = rangeStartMs + clamped * span;
      const cursor = new Date(Math.min(T, rangeEndMs));

      if (timelapseMode === 'cumulative') {
        const idx = countMilestonesAtOrBefore(times, T);
        readCounts(prefix, names.length, idx, countsScratch);
        drawTimelapseFrame(ctx, {
          timelapseMode: 'cumulative',
          names,
          counts: countsScratch.slice(0, names.length),
          cursorTime: cursor,
          rangeStart,
          rangeEnd,
          maxCount,
          width: outW,
          height: outH,
        });
        return;
      }

      const state = createRollingWindowState();
      advanceRollingWindow(timedChannelEvents, T, rollingMs, state);
      const top = topNFromCounts(state.counts);
      const frameMax = top.countsOut.length ? Math.max(...top.countsOut) : 1;
      drawTimelapseFrame(ctx, {
        timelapseMode: 'rolling',
        rollingWindowLabel: rollingLabelStr,
        names: top.names,
        counts: top.countsOut,
        cursorTime: cursor,
        rangeStart,
        rangeEnd,
        maxCount: frameMax,
        width: outW,
        height: outH,
      });
    },
    [
      timelapseMode,
      times,
      prefix,
      countsScratch,
      names,
      timedChannelEvents,
      rangeStart,
      rangeEnd,
      rangeStartMs,
      rangeEndMs,
      maxCount,
      outW,
      outH,
      rollingMs,
      rollingLabelStr,
    ]
  );

  useEffect(() => {
    renderCanvasAtProgress(previewProgress);
  }, [renderCanvasAtProgress, previewProgress]);

  useEffect(() => {
    if (busy) setPreviewPlaying(false);
  }, [busy]);

  useEffect(() => {
    if (!previewPlaying || busy || names.length === 0) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = previewProgressRef.current + dt / durationSec;
      if (next >= 1) {
        previewProgressRef.current = 1;
        setPreviewProgress(1);
        setPreviewPlaying(false);
        return;
      }
      previewProgressRef.current = next;
      setPreviewProgress(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [previewPlaying, busy, durationSec, names.length]);

  const pausePreview = useCallback(() => {
    setPreviewPlaying(false);
  }, []);

  const togglePreviewPlay = useCallback(() => {
    setPreviewPlaying((p) => {
      if (p) return false;
      if (previewProgressRef.current >= 1) {
        previewProgressRef.current = 0;
        setPreviewProgress(0);
      }
      return true;
    });
  }, []);

  const seekPreviewStart = useCallback(() => {
    pausePreview();
    previewProgressRef.current = 0;
    setPreviewProgress(0);
  }, [pausePreview]);

  const seekPreviewEnd = useCallback(() => {
    pausePreview();
    previewProgressRef.current = 1;
    setPreviewProgress(1);
  }, [pausePreview]);

  const onGenerate = useCallback(async () => {
    setError(null);
    if (names.length === 0) {
      setError('No channels in this range — widen the timeline or change the All / YouTube / Music filter.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('Video export needs MediaRecorder (try a recent desktop browser).');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Could not get a canvas context.');
      return;
    }

    const mime = pickWebmMimeType();
    if (!MediaRecorder.isTypeSupported(mime)) {
      setError('WebM recording is not supported in this browser.');
      return;
    }

    const fps = 30;
    const totalFrames = Math.max(1, Math.round(durationSec * fps));
    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    const span = Math.max(1, endMs - startMs);

    setBusy(true);
    setStatus('Recording…');

    const px = outW * outH;
    const basePx = 1280 * 720;
    const videoBitsPerSecond = Math.min(12_000_000, Math.round(2_800_000 * (px / basePx)));

    try {
      const stream = canvas.captureStream(fps);
      const chunks: Blob[] = [];
      try {
        const recorder = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond,
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        const stopped = new Promise<void>((resolve, reject) => {
          recorder.onerror = () => reject(new Error('Recorder error'));
          recorder.onstop = () => resolve();
        });

        recorder.start(100);

        const frameMs = 1000 / fps;
        const rollingState = timelapseMode === 'rolling' ? createRollingWindowState() : null;

        for (let f = 0; f < totalFrames; f++) {
          const u = totalFrames <= 1 ? 1 : f / (totalFrames - 1);
          const T = startMs + u * span;
          const cursor = new Date(Math.min(T, endMs));

          if (timelapseMode === 'cumulative') {
            const idx = countMilestonesAtOrBefore(times, T);
            readCounts(prefix, names.length, idx, countsScratch);
            drawTimelapseFrame(ctx, {
              timelapseMode: 'cumulative',
              names,
              counts: countsScratch.slice(0, names.length),
              cursorTime: cursor,
              rangeStart,
              rangeEnd,
              maxCount,
              width: outW,
              height: outH,
            });
          } else if (rollingState) {
            advanceRollingWindow(timedChannelEvents, T, rollingMs, rollingState);
            const top = topNFromCounts(rollingState.counts);
            const frameMax = top.countsOut.length ? Math.max(...top.countsOut) : 1;
            drawTimelapseFrame(ctx, {
              timelapseMode: 'rolling',
              rollingWindowLabel: rollingLabelStr,
              names: top.names,
              counts: top.countsOut,
              cursorTime: cursor,
              rangeStart,
              rangeEnd,
              maxCount: frameMax,
              width: outW,
              height: outH,
            });
          }
          setStatus(`Recording… ${Math.round(((f + 1) / totalFrames) * 100)}%`);
          await new Promise((r) => setTimeout(r, frameMs));
        }

        recorder.stop();
        await stopped;
      } finally {
        stream.getTracks().forEach((t) => t.stop());
      }

      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const modeTag =
        timelapseMode === 'rolling' ? rollingWindowFileTag(rollingWindowDays) : 'cumulative';
      a.download = `viewpulse-top-channels-${modeTag}-${outW}x${outH}-${new Date().toISOString().slice(0, 10)}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Download started.');
      renderCanvasAtProgress(previewProgressRef.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [
    names,
    times,
    prefix,
    countsScratch,
    rangeStart,
    rangeEnd,
    maxCount,
    durationSec,
    renderCanvasAtProgress,
    timelapseMode,
    timedChannelEvents,
    outW,
    outH,
    rollingMs,
    rollingLabelStr,
    rollingWindowDays,
  ]);

  if (names.length === 0) {
    return (
      <div className="videos-panel">
        <p className="games-blurb">
          Builds a short WebM timelapse of your top 10 channels (by watch count) across the selected period. Uses the
          same date range and All / YouTube / Music filter as the rest of the dashboard. Everything runs in your
          browser — nothing is uploaded.
        </p>
        <p className="games-empty">No channel data in this range. Adjust the timeline or source filter.</p>
      </div>
    );
  }

  return (
    <div className="videos-panel">
      <p className="games-blurb">
        <strong>Cumulative</strong> ranks the same 10 channels for the whole clip (by total watches in your selection)
        and grows their bars from the first watch forward. <strong>Rolling</strong> uses a sliding window (30, 90, or
        360 days) ending on each frame so the top 10 can change as habits shift. Export is WebM (VP9/VP8); Chrome or
        Firefox are most reliable.
      </p>

      <div className="videos-timelapse-controls">
        <label className="videos-timelapse-field">
          <span>Metric</span>
          <select
            value={timelapseMode}
            disabled={busy}
            onChange={(e) => setTimelapseMode(e.target.value as TimelapseMode)}
          >
            <option value="cumulative">Cumulative in range</option>
            <option value="rolling">Rolling window</option>
          </select>
        </label>
        {timelapseMode === 'rolling' ? (
          <label className="videos-timelapse-field">
            <span>Window</span>
            <select
              value={rollingWindowDays}
              disabled={busy}
              onChange={(e) => setRollingWindowDays(Number(e.target.value) as RollingWindowDays)}
            >
              {ROLLING_WINDOW_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="videos-timelapse-field">
          <span>Clip length</span>
          <select
            value={durationSec}
            disabled={busy}
            onChange={(e) => setDurationSec(Number(e.target.value) as (typeof DURATION_OPTIONS)[number]['value'])}
          >
            {DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="videos-timelapse-field videos-timelapse-field--wide">
          <span>Dimensions</span>
          <select
            value={dimensionId}
            disabled={busy}
            onChange={(e) => setDimensionId(e.target.value as TimelapseDimensionId)}
          >
            {TIMELAPSE_DIMENSION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="db-reset-btn videos-export-btn" disabled={busy} onClick={() => void onGenerate()}>
          {busy ? 'Working…' : 'Generate & download video'}
        </button>
      </div>

      {status ? <p className="videos-timelapse-status">{status}</p> : null}
      {error ? <p className="videos-timelapse-error">{error}</p> : null}

      <div className="videos-preview-wrap">
        <canvas
          ref={canvasRef}
          className="videos-timelapse-canvas"
          width={outW}
          height={outH}
          aria-label="Timelapse preview"
        />
      </div>

      <div className="videos-preview-transport" aria-label="Preview playback">
        <div className="videos-preview-transport-buttons">
          <button
            type="button"
            className="db-reset-btn videos-preview-jump"
            disabled={busy}
            onClick={seekPreviewStart}
            aria-label="Jump to start"
          >
            Start
          </button>
          <button
            type="button"
            className="db-reset-btn videos-preview-play"
            disabled={busy}
            onClick={togglePreviewPlay}
            aria-pressed={previewPlaying}
            aria-label={previewPlaying ? 'Pause preview' : 'Play preview'}
          >
            {previewPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="db-reset-btn videos-preview-jump"
            disabled={busy}
            onClick={seekPreviewEnd}
            aria-label="Jump to end"
          >
            End
          </button>
        </div>
        <label className="videos-preview-scrub">
          <span className="videos-preview-scrub-label">Time in selection</span>
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            disabled={busy}
            value={Math.round(previewProgress * 1000)}
            aria-valuemin={0}
            aria-valuemax={1000}
            aria-valuenow={Math.round(previewProgress * 1000)}
            aria-valuetext={`${Math.round(previewProgress * 100)}% through ${rangeStart.toLocaleDateString(undefined, { dateStyle: 'medium' })} to ${rangeEnd.toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
            onChange={(e) => {
              pausePreview();
              const v = Number(e.target.value) / 1000;
              previewProgressRef.current = v;
              setPreviewProgress(v);
            }}
          />
        </label>
        <p className="videos-preview-transport-hint">
          Play runs from start to end over {durationSec}s (same pacing as export). Drag the slider anytime; pause stops
          playback.
        </p>
      </div>

      <p className="videos-timelapse-meta">
        Export {outW}×{outH} ·{' '}
        {timelapseMode === 'cumulative'
          ? `${names.length} channels tracked · ${milestoneCount.toLocaleString()} watches in range`
          : `Rolling ${rollingWindowDays}d · ${timedChannelEvents.length.toLocaleString()} watches in dataset (incl. up to ${rollingWindowDays} days before range start)`}
      </p>
    </div>
  );
}
