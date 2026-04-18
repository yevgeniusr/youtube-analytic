'use client';

import { useMemo, useRef, useState } from 'react';
import { CHANNEL_OMITTED_IN_EXPORT, WatchEvent } from '@/lib/parser';
import { computeAnalytics } from '@/lib/analytics';
import { buildWatchHistoryContext } from '@/lib/watch-history-context';
import { DEFAULT_SHARE_HIGHLIGHTS, type ShareStatId } from '@/lib/share-stats-config';
import { DashboardAiExports, type AiExportPage } from '@/components/DashboardAiExports';
import { DashboardGames } from '@/components/DashboardGames';
import { DashboardVideos } from '@/components/DashboardVideos';
import { mixSeed, randomUint32 } from '@/lib/random-uint32';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was', 'were', 'have',
  'has', 'had', 'how', 'what', 'when', 'where', 'why', 'who', 'into', 'about', 'after', 'before',
  'than', 'then', 'its', 'it', 'our', 'out', 'all', 'not', 'can', 'will', 'just', 'now', 'new',
  'official', 'video', 'music', 'feat', 'ft', 'live', 'youtube', 'watch', 'watched', 'com', 'www',
  'https', 'http', 'html', 'org', 'net', 'amp', 'si', 'vevo', 'channel', 'subscribe', 'subscribed',
  'full', 'episode', 'ep', 'vs', 'via',
  // YouTube / format noise
  'shorts', 'short', 'tiktok', 'reels', 'stream', 'streaming', 'premiere', 'premiered', 'upload',
  'uhd', 'fps', 'hdr', 'asmr', 'lyrics', 'lyric',
  // Common English (extra)
  'also', 'any', 'some', 'them', 'they', 'their', 'there', 'these', 'those', 'here', 'her', 'his',
  'she', 'him', 'been', 'being', 'because', 'could', 'should', 'would', 'might', 'must', 'need',
  'get', 'got', 'getting', 'like', 'make', 'made', 'more', 'most', 'much', 'many', 'only', 'other',
  'another', 'such', 'same', 'very', 'really', 'even', 'still', 'ever', 'never', 'always', 'maybe',
  'yes', 'way', 'well', 'too', 'both', 'each', 'few', 'own', 'off', 'over', 'under', 'again',
  'once', 'twice', 'first', 'last', 'next', 'best', 'one', 'two', 'may', 'did', 'does', 'doing', 'done',
  'see', 'know', 'think', 'want', 'come', 'came', 'use', 'used', 'using', 'say', 'said', 'says',
  'going', 'went', 'give', 'gave', 'take', 'took', 'find', 'found', 'look', 'looking', 'thing',
  'things', 'something', 'nothing', 'everything', 'anything', 'someone', 'everyone', 'everybody',
  // Time / quantity filler in titles
  'year', 'years', 'day', 'days', 'week', 'weeks', 'month', 'months', 'hour', 'hours', 'minute',
  'minutes', 'ago', 'today', 'tonight', 'tomorrow', 'part', 'parts', 'pt', 'vol',
  // Title / promo boilerplate
  'trailer', 'trailers', 'teaser', 'highlights', 'highlight', 'recap', 'review', 'reviews', 'reaction',
  'reacts', 'podcast', 'interview', 'documentary', 'version', 'extended', 'remix', 'cover', 'covers',
  'compilation', 'update', 'updates', 'news', 'breaking', 'explained', 'explain', 'reason', 'reasons',
  'top', 'ultimate', 'complete', 'free', 'big', 'real', 'actually', 'probably',
]);

function extractKeywords(events: WatchEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const words = event.title.toLowerCase().split(/[^a-z0-9]+/g);
    for (const word of words) {
      if (word.length < 3) continue;
      if (STOP_WORDS.has(word)) continue;
      if (/^\d+$/.test(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 72);
  const max = sorted[0]?.[1] ?? 1;
  return sorted.map(([word, count]) => ({
    word,
    count,
    weight: Math.max(1, Math.ceil((count / max) * 5))
  }));
}

function BarColumns({
  data,
  barColor = 'rgba(255,255,255,0.75)',
  textColor = 'rgba(255,255,255,0.45)',
}: {
  data: { label: string; value: number }[];
  barColor?: string;
  textColor?: string;
}) {
  if (data.length === 0) return null;
  const H = 80;
  const W = 400;
  const max = Math.max(...data.map((d) => d.value), 1);
  const gap = 6;
  const barW = W / data.length - gap;

  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} preserveAspectRatio="none" style={{ width: '100%', height: '98px', display: 'block' }}>
      {data.map((d, i) => {
        const barH = Math.max(3, (d.value / max) * H);
        const x = i * (W / data.length) + gap / 2;
        const y = H - barH;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={barH} fill={barColor} rx="3" />
            <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="9" fill={textColor}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HourBars({ dist, peakHour }: { dist: number[]; peakHour: number }) {
  const max = Math.max(...dist, 1);
  return (
    <div className="hour-bars">
      {dist.map((v, i) => (
        <div
          key={i}
          className={`hour-bar${i === peakHour ? ' peak' : ''}`}
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
          title={`${formatHour(i)}: ${v} videos`}
        />
      ))}
    </div>
  );
}

function ChannelBars({
  channels,
}: {
  channels: Array<{ name: string; count: number; pct: number; url?: string }>;
}) {
  return (
    <div className="channel-bars">
      {channels.map((ch) => (
        <div key={ch.name} className="channel-row channel-row--static">
          <span className="channel-name-label">
            {ch.url ? (
              <a href={ch.url} target="_blank" rel="noreferrer">
                {ch.name}
              </a>
            ) : (
              ch.name
            )}
          </span>
          <div className="channel-bar-track">
            <div className="channel-bar-fill" style={{ width: `${ch.pct}%` }} />
          </div>
          <span className="channel-count-label">{ch.count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

type Filter = 'all' | 'youtube' | 'youtube-music';
type MainView = 'analytic' | 'ai-tools' | 'games' | 'videos';
type DragMode = 'none' | 'start' | 'end' | 'range';

interface DashboardProps {
  events: WatchEvent[];
  onReset: () => void;
}

export function Dashboard({ events, onReset }: DashboardProps) {
  const sortedEvents = useMemo(
    () => events.slice().sort((a, b) => a.watchedAt.getTime() - b.watchedAt.getTime()),
    [events]
  );

  const { minDate, maxDate } = useMemo(() => {
    const fallback = new Date();
    return {
      minDate: sortedEvents[0]?.watchedAt ?? fallback,
      maxDate: sortedEvents[sortedEvents.length - 1]?.watchedAt ?? fallback,
    };
  }, [sortedEvents]);

  const [startDate, setStartDate] = useState<Date>(minDate);
  const [endDate, setEndDate] = useState<Date>(maxDate);
  const [mainView, setMainView] = useState<MainView>('analytic');
  const [exportPanelTab, setExportPanelTab] = useState<AiExportPage>('openclaw');
  const gamesSeedRef = useRef(mixSeed(randomUint32(), randomUint32(), (Date.now() / 1000) | 0));
  const [showDebug, setShowDebug] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [debugQuery, setDebugQuery] = useState('');
  const [debugPage, setDebugPage] = useState(1);
  const [shareHighlights, setShareHighlights] = useState<ShareStatId[]>(() => [...DEFAULT_SHARE_HIGHLIGHTS]);

  const toggleShareHighlight = (id: ShareStatId) => {
    setShareHighlights((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const [dragState, setDragState] = useState<{
    mode: DragMode;
    anchorIndex: number;
    baseStart: number;
    baseEnd: number;
  }>({ mode: 'none', anchorIndex: 0, baseStart: 0, baseEnd: 0 });
  const [timelineHoverIdx, setTimelineHoverIdx] = useState<number | null>(null);

  const timelineBuckets = useMemo(() => {
    if (sortedEvents.length === 0) return [];
    const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const counts = new Map<string, number>();

    for (const event of sortedEvents) {
      const key = `${event.watchedAt.getFullYear()}-${String(event.watchedAt.getMonth() + 1).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const buckets: Array<{ key: string; label: string; count: number; startMs: number; endMs: number }> = [];

    const cursor = new Date(start);
    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${MONTHS[month]} '${String(year).slice(2)}`;
      const bucketStart = new Date(year, month, 1, 0, 0, 0, 0);
      const bucketEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      buckets.push({ key, label, count: counts.get(key) ?? 0, startMs: bucketStart.getTime(), endMs: bucketEnd.getTime() });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return buckets;
  }, [sortedEvents, minDate, maxDate]);

  const timelineYearTicks = useMemo(() => {
    if (timelineBuckets.length === 0) return [] as { year: number; pct: number }[];
    const out: { year: number; pct: number }[] = [];
    let prev: number | null = null;
    const last = timelineBuckets.length - 1;
    timelineBuckets.forEach((b, i) => {
      const y = new Date(b.startMs).getFullYear();
      if (y !== prev) {
        prev = y;
        out.push({ year: y, pct: last > 0 ? (i / last) * 100 : 0 });
      }
    });
    return out;
  }, [timelineBuckets]);

  const startIndex = Math.max(0, timelineBuckets.findIndex((bucket) => bucket.endMs >= startDate.getTime()));
  const endIndex = Math.max(
    startIndex,
    timelineBuckets.findIndex((bucket) => bucket.startMs <= endDate.getTime() && bucket.endMs >= endDate.getTime())
  );

  const filteredByZone = useMemo(
    () => events.filter((event) => {
      const ts = event.watchedAt.getTime();
      return ts >= startDate.getTime() && ts <= endDate.getTime();
    }),
    [events, startDate, endDate]
  );

  const hasYT = filteredByZone.some((e) => e.source === 'youtube');
  const hasMusic = filteredByZone.some((e) => e.source === 'youtube-music');
  const hasBoth = hasYT && hasMusic;

  const a = useMemo(() => computeAnalytics(filteredByZone, filter), [filteredByZone, filter]);
  const sourceEvents = useMemo(
    () => (filter === 'all' ? filteredByZone : filteredByZone.filter((event) => event.source === filter)),
    [filteredByZone, filter]
  );
  const gameChannelStats = useMemo(() => {
    const channelMap = new Map<string, { count: number; url?: string; sampleVideoId?: string }>();
    for (const event of sourceEvents) {
      if (event.channelName === CHANNEL_OMITTED_IN_EXPORT) continue;
      const existing = channelMap.get(event.channelName);
      if (existing) {
        existing.count++;
        if (!existing.sampleVideoId && event.videoId) existing.sampleVideoId = event.videoId;
      } else {
        channelMap.set(event.channelName, {
          count: 1,
          url: event.channelUrl,
          sampleVideoId: event.videoId,
        });
      }
    }
    return Array.from(channelMap.entries()).map(([name, v]) => ({ name, ...v }));
  }, [sourceEvents]);
  const keywordCloud = useMemo(() => extractKeywords(sourceEvents), [sourceEvents]);
  const openclawContext = useMemo(
    () =>
      buildWatchHistoryContext({
        analytics: a,
        events: sourceEvents,
        filter,
        startDate,
        endDate,
        topKeywords: keywordCloud.map(({ word, count }) => ({ word, count })),
      }),
    [a, sourceEvents, filter, startDate, endDate, keywordCloud]
  );
  const takeoutOmittedChannelCount = useMemo(
    () => sourceEvents.filter((e) => e.channelName === CHANNEL_OMITTED_IN_EXPORT).length,
    [sourceEvents]
  );
  const includedEvents = useMemo(() => {
    const sourceFiltered =
      filter === 'all' ? filteredByZone : filteredByZone.filter((event) => event.source === filter);
    const q = debugQuery.trim().toLowerCase();
    const textFiltered =
      q.length === 0
        ? sourceFiltered
        : sourceFiltered.filter((event) =>
            `${event.title} ${event.channelName} ${event.source}`.toLowerCase().includes(q)
          );
    return textFiltered.slice().sort((aEvent, bEvent) => bEvent.watchedAt.getTime() - aEvent.watchedAt.getTime());
  }, [filteredByZone, filter, debugQuery]);

  const debugPageSize = 50;
  const debugTotalPages = Math.max(1, Math.ceil(includedEvents.length / debugPageSize));
  const safeDebugPage = Math.min(debugPage, debugTotalPages);
  const debugPageItems = useMemo(() => {
    const start = (safeDebugPage - 1) * debugPageSize;
    return includedEvents.slice(start, start + debugPageSize);
  }, [includedEvents, safeDebugPage]);

  const ytPct = a.totalWatched > 0 ? Math.round((a.youtubeCount / a.totalWatched) * 100) : 0;
  const zoneCoverage = events.length > 0 ? Math.round((filteredByZone.length / events.length) * 100) : 0;
  const timelineMax = Math.max(...timelineBuckets.map((b) => b.count), 1);

  const setRangeByIndex = (nextStartIndex: number, nextEndIndex: number) => {
    if (timelineBuckets.length === 0) return;
    const maxIdx = timelineBuckets.length - 1;
    const safeStart = Math.max(0, Math.min(nextStartIndex, maxIdx));
    const safeEnd = Math.max(safeStart, Math.min(nextEndIndex, maxIdx));
    setStartDate(new Date(timelineBuckets[safeStart].startMs));
    setEndDate(new Date(timelineBuckets[safeEnd].endMs));
  };

  const indexFromPointer = (clientX: number, rect: DOMRect) => {
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    return Math.round(pct * Math.max(0, timelineBuckets.length - 1));
  };

  const startDrag = (
    e: React.PointerEvent<HTMLElement>,
    mode: DragMode,
    anchor = startIndex
  ) => {
    setTimelineHoverIdx(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({ mode, anchorIndex: anchor, baseStart: startIndex, baseEnd: endIndex });
  };

  const onScalePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.mode === 'none') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = indexFromPointer(e.clientX, rect);

    if (dragState.mode === 'start') {
      setRangeByIndex(Math.min(idx, endIndex), endIndex);
      return;
    }

    if (dragState.mode === 'end') {
      setRangeByIndex(startIndex, Math.max(idx, startIndex));
      return;
    }

    if (dragState.mode === 'range') {
      const width = dragState.baseEnd - dragState.baseStart;
      const shift = idx - dragState.anchorIndex;
      const maxStart = Math.max(0, timelineBuckets.length - 1 - width);
      const nextStart = Math.max(0, Math.min(maxStart, dragState.baseStart + shift));
      setRangeByIndex(nextStart, nextStart + width);
    }
  };

  const endDrag = () => {
    if (dragState.mode !== 'none') {
      setDragState((prev) => ({ ...prev, mode: 'none' }));
    }
  };

  const onTimelinePointerLeave = () => {
    setTimelineHoverIdx(null);
    endDrag();
  };

  const sparkPath = useMemo(() => {
    if (timelineBuckets.length < 2) return '';
    const W = 1000;
    const H = 120;
    const points = timelineBuckets.map((bucket, i) => {
      const x = (i / (timelineBuckets.length - 1)) * W;
      const y = H - (bucket.count / timelineMax) * (H - 10);
      return { x, y };
    });

    const line = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
      const prev = points[i - 1];
      const cpX = ((prev.x + pt.x) / 2).toFixed(2);
      return `${acc} C ${cpX} ${prev.y.toFixed(2)} ${cpX} ${pt.y.toFixed(2)} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
    }, '');

    return `${line} L 1000 120 L 0 120 Z`;
  }, [timelineBuckets, timelineMax]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="db-eyebrow">Analysis Complete</p>
          <h2 className="db-title">Your Watch History</h2>
        </div>
        <div className="db-header-actions">
          {hasBoth && (
            <div className="source-toggle" role="tablist" aria-label="YouTube vs Music">
              <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
              <button type="button" className={filter === 'youtube' ? 'active' : ''} onClick={() => setFilter('youtube')}>YouTube</button>
              <button type="button" className={filter === 'youtube-music' ? 'active' : ''} onClick={() => setFilter('youtube-music')}>Music</button>
            </div>
          )}
          <div className="source-toggle" role="tablist" aria-label="Dashboard section">
            <button type="button" className={mainView === 'analytic' ? 'active' : ''} onClick={() => setMainView('analytic')}>
              Analytic
            </button>
            <button type="button" className={mainView === 'ai-tools' ? 'active' : ''} onClick={() => setMainView('ai-tools')}>
              AI Tools
            </button>
            <button type="button" className={mainView === 'games' ? 'active' : ''} onClick={() => setMainView('games')}>
              Games
            </button>
            <button type="button" className={mainView === 'videos' ? 'active' : ''} onClick={() => setMainView('videos')}>
              Videos
            </button>
          </div>
          <button className="db-reset-btn" onClick={onReset}>← Start over</button>
        </div>
      </div>

      <div className="timeline-panel">
        <div className="timeline-head">
          <div>
            <p className="db-eyebrow">Chronology</p>
            <h3 className="timeline-title">Brush timeline</h3>
          </div>
          <div className="timeline-meta">
            <span>{filteredByZone.length.toLocaleString()} events</span>
            <span>{zoneCoverage}% coverage</span>
            <span>{isoDate(startDate)} → {isoDate(endDate)}</span>
          </div>
        </div>

        <div className="timeline-presets">
          <button className="db-reset-btn" onClick={() => setRangeByIndex(Math.max(0, timelineBuckets.length - 12), timelineBuckets.length - 1)}>Last 12 months</button>
          <button className="db-reset-btn" onClick={() => setRangeByIndex(Math.max(0, timelineBuckets.length - 36), timelineBuckets.length - 1)}>Last 3 years</button>
          <button className="db-reset-btn" onClick={() => setRangeByIndex(0, Math.max(0, timelineBuckets.length - 1))}>All time</button>
        </div>

        <div
          className="timeline-scale"
          onPointerMove={(e) => {
            if (dragState.mode === 'none' && timelineBuckets.length > 1) {
              const rect = e.currentTarget.getBoundingClientRect();
              setTimelineHoverIdx(indexFromPointer(e.clientX, rect));
            }
            onScalePointerMove(e);
          }}
          onPointerUp={endDrag}
          onPointerLeave={onTimelinePointerLeave}
        >
          <svg className="timeline-spark" viewBox="0 0 1000 120" preserveAspectRatio="none" role="img" aria-label="Watch history activity scale">
            <defs>
              <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7f50" />
                <stop offset="100%" stopColor="#e52d27" />
              </linearGradient>
            </defs>
            {sparkPath ? <path d={sparkPath} fill="url(#timelineGradient)" opacity="0.45" /> : null}
          </svg>
          {timelineHoverIdx !== null && timelineBuckets[timelineHoverIdx] ? (
            <div
              className="chart-hover-tooltip chart-hover-tooltip--timeline"
              style={{
                left: `${(timelineHoverIdx / Math.max(1, timelineBuckets.length - 1)) * 100}%`,
              }}
            >
              <strong>{timelineBuckets[timelineHoverIdx].label}</strong>
              <span>{timelineBuckets[timelineHoverIdx].count.toLocaleString()} videos</span>
            </div>
          ) : null}

          {timelineBuckets.length > 0 && (
            <>
              <div
                className="timeline-selection"
                style={{
                  left: `${(startIndex / Math.max(1, timelineBuckets.length - 1)) * 100}%`,
                  width: `${((endIndex - startIndex + 1) / Math.max(1, timelineBuckets.length)) * 100}%`,
                }}
                onPointerDown={(e) => startDrag(e, 'range', indexFromPointer(e.clientX, e.currentTarget.parentElement!.getBoundingClientRect()))}
              >
                <button
                  className="timeline-handle start"
                  aria-label="Drag start"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDrag(e, 'start');
                  }}
                />
                <button
                  className="timeline-handle end"
                  aria-label="Drag end"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDrag(e, 'end');
                  }}
                />
              </div>
              <svg
                className="timeline-hover-line-layer"
                viewBox="0 0 1000 120"
                preserveAspectRatio="none"
                aria-hidden
              >
                {timelineHoverIdx !== null && timelineBuckets.length > 1 ? (
                  <line
                    x1={(timelineHoverIdx / (timelineBuckets.length - 1)) * 1000}
                    x2={(timelineHoverIdx / (timelineBuckets.length - 1)) * 1000}
                    y1={4}
                    y2={116}
                    stroke="rgba(27, 32, 38, 0.65)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>
            </>
          )}
        </div>

        <div className="timeline-year-axis" aria-hidden>
          {timelineYearTicks.map((t, i) => (
            <span key={`${t.year}-${i}`} className="timeline-year-tick" style={{ left: `${t.pct}%` }}>
              {t.year}
            </span>
          ))}
        </div>
      </div>

      {mainView === 'ai-tools' && (
        <div className="export-panel">
          <div className="export-panel-tabs" role="tablist" aria-label="Tools">
            <button
              type="button"
              role="tab"
              aria-selected={exportPanelTab === 'openclaw'}
              className={`export-panel-tab${exportPanelTab === 'openclaw' ? ' active' : ''}`}
              onClick={() => setExportPanelTab('openclaw')}
            >
              OpenClaw
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={exportPanelTab === 'parents'}
              className={`export-panel-tab${exportPanelTab === 'parents' ? ' active' : ''}`}
              onClick={() => setExportPanelTab('parents')}
            >
              For Parents
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={exportPanelTab === 'recs'}
              className={`export-panel-tab${exportPanelTab === 'recs' ? ' active' : ''}`}
              onClick={() => setExportPanelTab('recs')}
            >
              Recs
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={exportPanelTab === 'imageReports'}
              className={`export-panel-tab${exportPanelTab === 'imageReports' ? ' active' : ''}`}
              onClick={() => setExportPanelTab('imageReports')}
            >
              Image Reports
            </button>
          </div>

          <DashboardAiExports
            page={exportPanelTab}
            context={openclawContext}
            shareHighlights={shareHighlights}
            onToggleShareHighlight={toggleShareHighlight}
          />
        </div>
      )}

      {mainView === 'games' && (
        <DashboardGames
          channelStats={gameChannelStats}
          rewatchList={a.rewatchGamePool}
          sourceEvents={sourceEvents}
          rangeStart={startDate}
          rangeEnd={endDate}
          seedBase={gamesSeedRef.current}
        />
      )}

      {mainView === 'videos' && (
        <DashboardVideos sourceEvents={sourceEvents} rangeStart={startDate} rangeEnd={endDate} />
      )}

      {mainView === 'analytic' && (
      <div className="db-grid">
        <div className="db-tile tile-dark span-2">
          <span className="tile-tag">Total Watched</span>
          <div className="tile-big">{formatNum(a.totalWatched)}</div>
          <p className="tile-sub">videos in your history</p>
        </div>

        <div className="db-tile tile-red span-2">
          <span className="tile-tag">Date Range</span>
          <div className="tile-big tile-big--sm">{formatDate(a.dateFrom)}</div>
          <p className="tile-sub">to {formatDate(a.dateTo)} · {a.daysSpan.toLocaleString()} days</p>
        </div>

        <div className="db-tile tile-blue span-2">
          <span className="tile-tag">Peak Hour</span>
          <div className="tile-big">{formatHour(a.peakHour)}</div>
          <p className="tile-sub">most active hour of day</p>
        </div>

        <div className="db-tile tile-off span-2">
          <span className="tile-tag">Unique Channels</span>
          <div className="tile-big tile-big--ink">{formatNum(a.uniqueChannels)}</div>
          <p className="tile-sub tile-sub--muted">creators watched</p>
        </div>

        <div className="db-tile tile-green span-2">
          <span className="tile-tag">Avg / Day</span>
          <div className="tile-big">{a.avgPerDay}</div>
          <p className="tile-sub">videos per day average</p>
        </div>

        <div className="db-tile tile-yellow span-2">
          <span className="tile-tag">YouTube vs Music</span>
          <div className="tile-big tile-big--yellow">{ytPct}%</div>
          <p className="tile-sub tile-sub--dark">
            {a.youtubeCount.toLocaleString()} YT · {a.musicCount.toLocaleString()} Music
          </p>
          <div className="split-bar-track">
            <div className="split-bar-fill" style={{ width: `${ytPct}%` }} />
          </div>
        </div>

        <div className="db-tile tile-card span-7">
          <span className="tile-tag tile-tag--muted">Top Channels</span>
          {takeoutOmittedChannelCount > 0 && (
            <p className="tile-sub tile-sub--muted" style={{ marginBottom: '0.45rem', fontSize: '0.68rem' }}>
              {takeoutOmittedChannelCount.toLocaleString()} watches have{' '}
              <strong>{CHANNEL_OMITTED_IN_EXPORT}</strong> — Google often exports only the video link for those rows,
              so the channel name was never in your file.
            </p>
          )}
          <div className="channel-bars-scroll">
            <ChannelBars channels={a.topChannels} />
          </div>
        </div>

        <div className="db-tile tile-dark span-5">
          <span className="tile-tag">Hourly Activity</span>
          <p className="tile-sub" style={{ marginBottom: '0.5rem' }}>
            Peak at {formatHour(a.peakHour)} · Most active: {a.peakDay}s
          </p>
          <HourBars dist={a.hourlyDist} peakHour={a.peakHour} />
          <div className="hour-labels">
            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
          </div>
        </div>

        <div className="db-tile tile-green span-6">
          <span className="tile-tag">Daily streak</span>
          <div className="tile-big">{a.dailyStreakBest.days.toLocaleString()}</div>
          <p className="tile-sub">best run of consecutive calendar days with at least one watch</p>
          <p className="tile-sub" style={{ marginTop: '0.45rem', opacity: 0.9 }}>
            Longest streak ended <strong>{a.dailyStreakBest.endDateLabel}</strong>
          </p>
          <p className="tile-sub" style={{ marginTop: '0.35rem', fontSize: '0.72rem', opacity: 0.88 }}>
            Active streak through range end:{' '}
            <strong>{a.dailyStreakCurrent}</strong> day{a.dailyStreakCurrent === 1 ? '' : 's'}
          </p>
        </div>

        <div className="db-tile tile-blue span-6">
          <span className="tile-tag">Weekly streak</span>
          <div className="tile-big">{a.weeklyStreakBest.weeks.toLocaleString()}</div>
          <p className="tile-sub">best run of consecutive weeks (Mon–Sun) with at least one watch</p>
          <p className="tile-sub" style={{ marginTop: '0.45rem', opacity: 0.9 }}>
            Longest streak ended week of <strong>{a.weeklyStreakBest.endWeekLabel}</strong>
          </p>
          <p className="tile-sub" style={{ marginTop: '0.35rem', fontSize: '0.72rem', opacity: 0.88 }}>
            Active streak through range end:{' '}
            <strong>{a.weeklyStreakCurrent}</strong> week{a.weeklyStreakCurrent === 1 ? '' : 's'}
          </p>
        </div>

        <div className="db-tile tile-off span-12">
          <span className="tile-tag tile-tag--muted">Year by Year</span>
          <p className="tile-sub tile-sub--muted" style={{ marginBottom: '0.75rem' }}>
            Most active year: <strong>{a.topYear}</strong> · History spans {a.yearlyBreakdown.length} year{a.yearlyBreakdown.length !== 1 ? 's' : ''}
          </p>
          <BarColumns data={a.yearlyBreakdown.map((y) => ({ label: String(y.year), value: y.count }))} barColor="var(--ink)" textColor="var(--muted)" />
        </div>

        <div className="db-tile tile-card span-12">
          <span className="tile-tag tile-tag--muted">Most rewatched</span>
          <p className="tile-sub tile-sub--muted" style={{ marginBottom: '0.65rem' }}>
            Videos played more than once in this range (same title when no video ID)
          </p>
          {a.mostRewatched.length === 0 ? (
            <p className="tile-sub tile-sub--muted">Nothing was watched more than once.</p>
          ) : (
            <div className="channel-video-list rewatch-list">
              {a.mostRewatched.map((v, idx) => (
                <div key={`${v.videoId ?? 't'}-${idx}-${v.title.slice(0, 24)}`} className="channel-video-item">
                  <p className="channel-video-title">
                    {v.videoId ? (
                      <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`} target="_blank" rel="noreferrer">
                        {v.title}
                      </a>
                    ) : (
                      v.title
                    )}
                  </p>
                  <p className="channel-video-meta">
                    {v.channelName} · {v.count} plays · last {v.lastWatchedAt.toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="db-tile tile-dark span-12">
          <span className="tile-tag">Keyword Bubbles</span>
          <p className="tile-sub" style={{ marginBottom: '0.8rem' }}>
            Frequent words from included video titles
          </p>
          <div className="keyword-cloud">
            {keywordCloud.map((item) => (
              <span key={item.word} className={`keyword-bubble w${item.weight}`} title={`${item.word}: ${item.count}`}>
                {item.word}
              </span>
            ))}
            {keywordCloud.length === 0 && <span className="tile-sub">No keyword data</span>}
          </div>
        </div>
      </div>
      )}

      {showDebug && (
        <section className="debug-panel">
          <div className="debug-head">
            <div>
              <p className="db-eyebrow">Debug</p>
              <h3 className="timeline-title">Videos included in current statistics</h3>
            </div>
            <span className="debug-count">{includedEvents.length.toLocaleString()} included</span>
          </div>
          <div className="debug-controls">
            <input
              value={debugQuery}
              onChange={(e) => {
                setDebugQuery(e.target.value);
                setDebugPage(1);
              }}
              placeholder="Search title/channel/source..."
              aria-label="Search included videos"
            />
            <span>Page {safeDebugPage} / {debugTotalPages}</span>
          </div>
          <div className="debug-table-wrap">
            <table className="debug-table">
              <thead>
                <tr>
                  <th>Watched At</th>
                  <th>Title</th>
                  <th>Channel</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {debugPageItems.map((event, idx) => (
                  <tr key={`${event.watchedAt.getTime()}-${event.title}-${idx}`}>
                    <td>{event.watchedAt.toLocaleString()}</td>
                    <td>{event.title}</td>
                    <td>{event.channelName}</td>
                    <td>{event.source}</td>
                  </tr>
                ))}
                {debugPageItems.length === 0 && (
                  <tr>
                    <td colSpan={4}>No videos match current filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="debug-pager">
            <button type="button" className="db-reset-btn" disabled={safeDebugPage <= 1} onClick={() => setDebugPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <button type="button" className="db-reset-btn" disabled={safeDebugPage >= debugTotalPages} onClick={() => setDebugPage((p) => Math.min(debugTotalPages, p + 1))}>
              Next
            </button>
          </div>
        </section>
      )}

      <div className="dashboard-footer-debug">
        <button
          type="button"
          className="dashboard-debug-text-btn"
          onClick={() => {
            setShowDebug((prev) => !prev);
            setDebugPage(1);
          }}
        >
          {showDebug ? 'Close debug' : 'Debug included videos'}
        </button>
      </div>
    </div>
  );
}
