'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { WatchEvent } from '@/lib/parser';
import type { GameDifficulty } from '@/lib/games-types';
import type { GamesProgressHistoryDuel } from '@/lib/games-progress-storage';
import { mixSeed, randomUint32 } from '@/lib/random-uint32';
import type { YoutubeOembedResult } from '@/lib/youtube-oembed';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EXPOSURE_WEIGHT_POWER = 2.45;

function itemSelectionWeight(id: string, exposure: Readonly<Record<string, number>>): number {
  const c = exposure[id] ?? 0;
  return 1 / Math.pow(1 + c, EXPOSURE_WEIGHT_POWER);
}

function weightedPick<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  rand: () => number
): T | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0]!;
  let total = 0;
  const w: number[] = [];
  for (const t of items) {
    const wi = Math.max(weightOf(t), 1e-12);
    w.push(wi);
    total += wi;
  }
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= w[i]!;
    if (r < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function difficultySalt(d: GameDifficulty): number {
  if (d === 'easy') return 1;
  if (d === 'medium') return 2;
  return 3;
}

export type HistoryDuelBucket = {
  key: string;
  label: string;
  count: number;
  startMs: number;
  endMs: number;
};

function buildZoneMonthlyBuckets(events: WatchEvent[], rangeStart: Date, rangeEnd: Date): HistoryDuelBucket[] {
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  if (re <= rs) return [];

  const inRange = events.filter((e) => {
    const t = e.watchedAt.getTime();
    return t >= rs && t <= re;
  });
  if (inRange.length === 0) return [];

  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  const counts = new Map<string, number>();

  for (const event of inRange) {
    const key = `${event.watchedAt.getFullYear()}-${String(event.watchedAt.getMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const buckets: HistoryDuelBucket[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = `${MONTHS[month]} '${String(year).slice(2)}`;
    const bucketStart = new Date(year, month, 1, 0, 0, 0, 0);
    const bucketEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    buckets.push({
      key,
      label,
      count: counts.get(key) ?? 0,
      startMs: bucketStart.getTime(),
      endMs: bucketEnd.getTime(),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function yearTicksForBuckets(buckets: HistoryDuelBucket[]): { year: number; pct: number }[] {
  if (buckets.length === 0) return [];
  const out: { year: number; pct: number }[] = [];
  let prev: number | null = null;
  const last = buckets.length - 1;
  buckets.forEach((b, i) => {
    const y = new Date(b.startMs).getFullYear();
    if (y !== prev) {
      prev = y;
      out.push({ year: y, pct: last > 0 ? (i / last) * 100 : 0 });
    }
  });
  return out;
}

export type FirstWatchCandidate = {
  id: string;
  title: string;
  channelName: string;
  videoId?: string;
  firstWatchedAt: Date;
};

function buildFirstWatchCandidates(
  sourceEvents: WatchEvent[],
  rangeStart: Date,
  rangeEnd: Date
): FirstWatchCandidate[] {
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  const map = new Map<
    string,
    { first: Date; title: string; channelName: string; videoId?: string }
  >();

  for (const e of sourceEvents) {
    const id = e.videoId ?? `t:${e.title}\0${e.channelName}`;
    const t = e.watchedAt.getTime();
    const cur = map.get(id);
    if (!cur || t < cur.first.getTime()) {
      map.set(id, {
        first: e.watchedAt,
        title: e.title,
        channelName: e.channelName,
        videoId: e.videoId,
      });
    }
  }

  const out: FirstWatchCandidate[] = [];
  map.forEach((v, id) => {
    const ft = v.first.getTime();
    if (ft >= rs && ft <= re) {
      out.push({
        id,
        title: v.title,
        channelName: v.channelName,
        videoId: v.videoId,
        firstWatchedAt: v.first,
      });
    }
  });
  return out;
}

function indexFromPointer(clientX: number, rect: DOMRect, bucketCount: number) {
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
  return Math.round(pct * Math.max(0, bucketCount - 1));
}

function dateFromPointer(clientX: number, rect: DOMRect, rangeStart: Date, rangeEnd: Date): Date {
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
  const t0 = rangeStart.getTime();
  const t1 = rangeEnd.getTime();
  return new Date(t0 + pct * (t1 - t0));
}

function xForTimeMs(ms: number, rangeStart: Date, rangeEnd: Date): number {
  const t0 = rangeStart.getTime();
  const t1 = rangeEnd.getTime();
  if (t1 <= t0) return 500;
  const p = Math.max(0, Math.min(1, (ms - t0) / (t1 - t0)));
  return p * 1000;
}

function roundPointsForError(err01: number, difficulty: GameDifficulty): number {
  const e = Math.max(0, Math.min(1, err01));
  if (difficulty === 'easy') return Math.round(1000 * (1 - Math.sqrt(e)));
  if (difficulty === 'hard') return Math.round(1000 * (1 - e) * (1 - e));
  return Math.round(1000 * (1 - e));
}

function formatShortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

type OembedEntry =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: YoutubeOembedResult }
  | { status: 'error' };

function useOembedVideo(watchUrl: string | null, roundKey: number) {
  const [entry, setEntry] = useState<OembedEntry>({ status: 'idle' });

  useEffect(() => {
    if (!watchUrl) return;
    setEntry({ status: 'loading' });
    const ac = new AbortController();
    fetch(`/api/youtube-oembed?url=${encodeURIComponent(watchUrl)}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: YoutubeOembedResult) => {
        setEntry({ status: 'ok', data });
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setEntry((prev) => (prev.status === 'ok' ? prev : { status: 'error' }));
      });
    return () => ac.abort();
  }, [watchUrl, roundKey]);

  return entry;
}

export function HistoryDuelGame({
  sourceEvents,
  rangeStart,
  rangeEnd,
  seedBase,
  difficulty,
  score,
  onRoundScore,
  progressEpoch,
  exposureById,
  onRecordExposure,
}: {
  sourceEvents: WatchEvent[];
  rangeStart: Date;
  rangeEnd: Date;
  seedBase: number;
  difficulty: GameDifficulty;
  score: GamesProgressHistoryDuel;
  onRoundScore: (points: number) => void;
  progressEpoch: number;
  exposureById: Readonly<Record<string, number>>;
  onRecordExposure: (id: string) => void;
}) {
  const gradientId = useId().replace(/:/g, '');
  const [roundKey, setRoundKey] = useState(0);
  const [sessionSalt] = useState(() => randomUint32());
  const [roundSalt, setRoundSalt] = useState(() => randomUint32());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [guessMs, setGuessMs] = useState<number | null>(null);
  const [roundPoints, setRoundPoints] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const skipFirstDifficultyEffect = useRef(true);
  const prevEpoch = useRef(progressEpoch);
  const exposureRef = useRef(exposureById);
  exposureRef.current = exposureById;
  const exposureLoggedRef = useRef('');
  const pointerPickRef = useRef(false);
  const answeredRoundRef = useRef<number | null>(null);

  const buckets = useMemo(
    () => buildZoneMonthlyBuckets(sourceEvents, rangeStart, rangeEnd),
    [sourceEvents, rangeStart, rangeEnd]
  );

  const candidates = useMemo(
    () => buildFirstWatchCandidates(sourceEvents, rangeStart, rangeEnd),
    [sourceEvents, rangeStart, rangeEnd]
  );

  const yearTicks = useMemo(() => yearTicksForBuckets(buckets), [buckets]);

  const timelineMax = useMemo(() => Math.max(...buckets.map((b) => b.count), 1), [buckets]);

  const sparkPath = useMemo(() => {
    if (buckets.length === 0) return '';
    const W = 1000;
    const H = 120;
    if (buckets.length === 1) {
      const y = H - (buckets[0]!.count / timelineMax) * (H - 10);
      return `M 0 ${y.toFixed(2)} L ${W} ${y.toFixed(2)} L ${W} 120 L 0 120 Z`;
    }
    const points = buckets.map((bucket, i) => {
      const x = (i / (buckets.length - 1)) * W;
      const y = H - (bucket.count / timelineMax) * (H - 10);
      return { x, y };
    });
    const line = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
      const prev = points[i - 1]!;
      const cpX = ((prev.x + pt.x) / 2).toFixed(2);
      return `${acc} C ${cpX} ${prev.y.toFixed(2)} ${cpX} ${pt.y.toFixed(2)} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
    }, '');
    return `${line} L 1000 120 L 0 120 Z`;
  }, [buckets, timelineMax]);

  const current = useMemo(() => {
    const exclude = new Set(recentIds);
    const pool = candidates.filter((c) => !exclude.has(c.id));
    const usePool = pool.length > 0 ? pool : candidates;
    if (usePool.length === 0) return null as FirstWatchCandidate | null;
    const rand = mulberry32(
      mixSeed(
        seedBase >>> 0,
        roundKey * 40_009,
        difficultySalt(difficulty) * 90_011,
        sessionSalt >>> 0,
        roundSalt >>> 0,
        0xfacefeed
      )
    );
    return weightedPick(usePool, (c) => itemSelectionWeight(c.id, exposureRef.current), rand);
  }, [candidates, recentIds, roundKey, seedBase, difficulty, sessionSalt, roundSalt]);

  const watchUrl = current?.videoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(current.videoId)}`
    : null;
  const oembedEntry = useOembedVideo(watchUrl, roundKey);
  const oembed = oembedEntry.status === 'ok' ? oembedEntry.data : null;
  const thumbLoading = Boolean(watchUrl && (!oembedEntry || oembedEntry.status === 'loading'));
  const thumbFailed = oembedEntry.status === 'error';

  useEffect(() => {
    if (!current) return;
    const sig = `${roundKey}:${current.id}`;
    if (exposureLoggedRef.current === sig) return;
    exposureLoggedRef.current = sig;
    onRecordExposure(current.id);
  }, [current, roundKey, onRecordExposure]);

  useEffect(() => {
    if (skipFirstDifficultyEffect.current) {
      skipFirstDifficultyEffect.current = false;
      return;
    }
    setRecentIds([]);
    setRoundSalt(randomUint32());
    setRevealed(false);
    setGuessMs(null);
    setRoundPoints(null);
    setHoverIdx(null);
    answeredRoundRef.current = null;
    setRoundKey((k) => k + 1);
  }, [difficulty]);

  useEffect(() => {
    if (prevEpoch.current !== progressEpoch) {
      prevEpoch.current = progressEpoch;
      setRecentIds([]);
      setRoundSalt(randomUint32());
      setRevealed(false);
      setGuessMs(null);
      setRoundPoints(null);
      setHoverIdx(null);
      answeredRoundRef.current = null;
      setRoundKey(0);
    }
  }, [progressEpoch]);

  const onScalePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (buckets.length <= 1) {
      setHoverIdx(0);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverIdx(indexFromPointer(e.clientX, rect, buckets.length));
  };

  const onScalePointerLeave = () => {
    setHoverIdx(null);
  };

  const submitGuessAt = useCallback(
    (clientX: number, el: HTMLDivElement) => {
      if (buckets.length === 0 || !current) return;
      if (answeredRoundRef.current === roundKey) return;
      const rect = el.getBoundingClientRect();
      const guess = dateFromPointer(clientX, rect, rangeStart, rangeEnd);
      const truthMs = current.firstWatchedAt.getTime();
      const span = rangeEnd.getTime() - rangeStart.getTime();
      const err01 = span > 0 ? Math.abs(guess.getTime() - truthMs) / span : 0;
      const pts = roundPointsForError(err01, difficulty);
      answeredRoundRef.current = roundKey;
      setGuessMs(guess.getTime());
      setRoundPoints(pts);
      setRevealed(true);
      setHoverIdx(null);
      onRoundScore(pts);
    },
    [buckets.length, current, roundKey, rangeStart, rangeEnd, difficulty, onRoundScore]
  );

  const nextRound = useCallback(() => {
    if (current) {
      setRecentIds((prev) => [...prev, current.id].slice(-36));
    }
    setRoundSalt(randomUint32());
    setRevealed(false);
    setGuessMs(null);
    setRoundPoints(null);
    setHoverIdx(null);
    answeredRoundRef.current = null;
    setRoundKey((k) => k + 1);
  }, [current]);

  if (candidates.length === 0 || buckets.length === 0) {
    return (
      <p className="games-empty">
        Need videos in this date range with at least one play. Widen the brush or switch All / YouTube / Music if the
        range is empty.
      </p>
    );
  }

  if (!current) {
    return <p className="games-empty">Could not pick a video — try again.</p>;
  }

  const headline = oembed?.title ?? current.title;
  const metaLine = oembed?.author_name ?? current.channelName;
  const thumbUrl = oembed?.thumbnail_url;

  const truthMs = current.firstWatchedAt.getTime();

  return (
    <div className="history-duel">
      <p className="games-duel-hint">When did you first watch this video in this range? Click the timeline.</p>

      <div className="history-duel-video">
        <div className="guess-card-media history-duel-video-media">
          {thumbLoading ? (
            <div className="guess-card-thumb guess-card-thumb--skeleton" aria-hidden />
          ) : thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="guess-card-thumb"
              src={thumbUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="guess-card-thumb guess-card-thumb--placeholder" aria-hidden>
              {current.title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="history-duel-video-body">
          <span className="guess-card-title">
            {watchUrl ? (
              <a href={watchUrl} target="_blank" rel="noreferrer">
                {headline}
              </a>
            ) : (
              headline
            )}
          </span>
          {metaLine && <span className="guess-card-meta">{metaLine}</span>}
          {thumbFailed && watchUrl && (
            <span className="guess-card-oembed-fail">YouTube preview unavailable — title from your file.</span>
          )}
        </div>
      </div>

      <div className="timeline-panel history-duel-timeline-wrap">
        <div className="timeline-head">
          <div>
            <p className="db-eyebrow">Chronology</p>
            <h3 className="timeline-title">History check</h3>
          </div>
          <div className="timeline-meta">
            <span>{formatShortDate(rangeStart)} → {formatShortDate(rangeEnd)}</span>
          </div>
        </div>

        <div
          role="presentation"
          className={`timeline-scale${revealed ? '' : ' timeline-scale--history-pick'}`}
          onPointerMove={onScalePointerMove}
          onPointerLeave={onScalePointerLeave}
          onPointerDown={(e) => {
            if (revealed) return;
            pointerPickRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (!pointerPickRef.current || revealed) return;
            pointerPickRef.current = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* not captured */
            }
            submitGuessAt(e.clientX, e.currentTarget);
          }}
          onPointerCancel={(e) => {
            pointerPickRef.current = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* */
            }
          }}
        >
          <svg
            className="timeline-spark"
            viewBox="0 0 1000 120"
            preserveAspectRatio="none"
            role="img"
            aria-label="Activity in the selected date range"
          >
            <defs>
              <linearGradient id={`historyTimelineGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7f50" />
                <stop offset="100%" stopColor="#e52d27" />
              </linearGradient>
            </defs>
            {sparkPath ? (
              <path d={sparkPath} fill={`url(#historyTimelineGradient-${gradientId})`} opacity="0.45" />
            ) : null}
          </svg>

          {hoverIdx !== null && buckets[hoverIdx] && !revealed ? (
            <div
              className="chart-hover-tooltip chart-hover-tooltip--timeline"
              style={{
                left: `${(hoverIdx / Math.max(1, buckets.length - 1)) * 100}%`,
              }}
            >
              <strong>{buckets[hoverIdx].label}</strong>
              <span>{buckets[hoverIdx].count.toLocaleString()} videos</span>
            </div>
          ) : null}

          {buckets.length > 0 ? (
            <svg className="timeline-hover-line-layer" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden>
              {hoverIdx !== null && buckets.length > 1 && !revealed ? (
                <line
                  x1={(hoverIdx / (buckets.length - 1)) * 1000}
                  x2={(hoverIdx / (buckets.length - 1)) * 1000}
                  y1={4}
                  y2={116}
                  stroke="rgba(27, 32, 38, 0.65)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {revealed && guessMs !== null ? (
                <line
                  x1={xForTimeMs(guessMs, rangeStart, rangeEnd)}
                  x2={xForTimeMs(guessMs, rangeStart, rangeEnd)}
                  y1={4}
                  y2={116}
                  stroke="rgba(37, 99, 235, 0.85)"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {revealed ? (
                <line
                  x1={xForTimeMs(truthMs, rangeStart, rangeEnd)}
                  x2={xForTimeMs(truthMs, rangeStart, rangeEnd)}
                  y1={4}
                  y2={116}
                  stroke="rgba(22, 163, 74, 0.9)"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>
          ) : null}
        </div>

        <div className="timeline-year-axis" aria-hidden>
          {yearTicks.map((t, i) => (
            <span key={`${t.year}-${i}`} className="timeline-year-tick" style={{ left: `${t.pct}%` }}>
              {t.year}
            </span>
          ))}
        </div>
      </div>

      <div className="guess-duel-result history-duel-result">
        <p
          className="guess-duel-result-message"
          aria-hidden={!revealed}
          {...(revealed ? { 'aria-live': 'polite' as const } : {})}
        >
          {revealed && guessMs !== null && roundPoints !== null ? (
            <>
              <strong>{roundPoints.toLocaleString()} pts</strong> — your pick {formatShortDate(new Date(guessMs))}; first
              in range {formatShortDate(current.firstWatchedAt)}.
            </>
          ) : null}
        </p>
        <button type="button" className="db-reset-btn games-next-btn" disabled={!revealed} onClick={nextRound}>
          Next round
        </button>
      </div>

      <p className="games-score" aria-live="polite">
        Total {score.totalPoints.toLocaleString()} pts · {score.rounds.toLocaleString()} rounds
        {score.rounds > 0 && ` · avg ${Math.round(score.totalPoints / score.rounds)} pts/round`}
      </p>
    </div>
  );
}
