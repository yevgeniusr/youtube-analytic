import { CHANNEL_OMITTED_IN_EXPORT, type WatchEvent } from '@/lib/parser';

/** Default export size (16∶9 720p). */
export const TIMELAPSE_W = 1280;
export const TIMELAPSE_H = 720;

export type TimelapseDimensionPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

/**
 * Landscape + TikTok / YouTube Shorts style vertical (9∶16). TikTok recommends 1080×1920.
 */
export const TIMELAPSE_DIMENSION_PRESETS: readonly TimelapseDimensionPreset[] = [
  { id: '1280x720', label: '720p landscape (16∶9) · 1280×720', width: 1280, height: 720 },
  { id: '1920x1080', label: '1080p landscape (16∶9) · 1920×1080', width: 1920, height: 1080 },
  { id: 'tiktok-1080', label: 'TikTok / Shorts (9∶16) · 1080×1920', width: 1080, height: 1920 },
  { id: 'tiktok-720', label: 'TikTok / Shorts (9∶16) · 720×1280', width: 720, height: 1280 },
] as const;

export type TimelapseDimensionId = (typeof TIMELAPSE_DIMENSION_PRESETS)[number]['id'];

export const DEFAULT_TIMELAPSE_DIMENSION_ID: TimelapseDimensionId = '1280x720';

export function getTimelapseDimensionPreset(id: string): TimelapseDimensionPreset {
  const found = TIMELAPSE_DIMENSION_PRESETS.find((p) => p.id === id);
  return found ?? TIMELAPSE_DIMENSION_PRESETS[0]!;
}

/** Supported rolling-window lengths (calendar-day multiples of 24h). */
export const ROLLING_WINDOW_DAY_OPTIONS = [30, 90, 360] as const;

export type RollingWindowDays = (typeof ROLLING_WINDOW_DAY_OPTIONS)[number];

export const DEFAULT_ROLLING_WINDOW_DAYS: RollingWindowDays = 30;

export function rollingWindowMs(days: RollingWindowDays): number {
  return days * 24 * 60 * 60 * 1000;
}

/** Human label for canvas UI, e.g. "90-day window". */
export function rollingWindowLabel(days: RollingWindowDays): string {
  return `${days}-day window`;
}

/** Filename segment, e.g. rolling-90d */
export function rollingWindowFileTag(days: RollingWindowDays): string {
  return `rolling-${days}d`;
}

/** @deprecated Prefer {@link rollingWindowMs} with {@link DEFAULT_ROLLING_WINDOW_DAYS}. */
export const ROLLING_WINDOW_MS = rollingWindowMs(30);

export type TimelapseMode = 'cumulative' | 'rolling';

export type TimedChannelEvent = { t: number; name: string };

/**
 * Events that can appear in any rolling window while the cursor T moves from rangeStart to rangeEnd:
 * watches with t ∈ (rangeStart − windowMs, rangeEnd].
 */
export function buildTimedChannelEvents(
  events: readonly WatchEvent[],
  rangeStartMs: number,
  rangeEndMs: number,
  windowMs: number
): TimedChannelEvent[] {
  const loExclusive = rangeStartMs - windowMs;
  const list: TimedChannelEvent[] = [];
  for (const e of events) {
    if (e.channelName === CHANNEL_OMITTED_IN_EXPORT) continue;
    const t = e.watchedAt.getTime();
    if (t <= loExclusive || t > rangeEndMs) continue;
    list.push({ t, name: e.channelName });
  }
  list.sort((a, b) => a.t - b.t);
  return list;
}

export type RollingWindowState = {
  left: number;
  right: number;
  counts: Map<string, number>;
};

export function createRollingWindowState(): RollingWindowState {
  return { left: 0, right: -1, counts: new Map() };
}

/**
 * Advance sliding window to time T: counts watches in (T − windowMs, T].
 * `ev` must be sorted by t ascending. Call with non-decreasing T only.
 */
export function advanceRollingWindow(
  ev: readonly TimedChannelEvent[],
  T: number,
  windowMs: number,
  state: RollingWindowState
): void {
  while (state.right + 1 < ev.length && ev[state.right + 1]!.t <= T) {
    state.right++;
    const n = ev[state.right]!.name;
    state.counts.set(n, (state.counts.get(n) ?? 0) + 1);
  }
  const cut = T - windowMs;
  while (state.left <= state.right) {
    if (ev[state.left]!.t > cut) break;
    const n = ev[state.left]!.name;
    const c = (state.counts.get(n) ?? 0) - 1;
    if (c <= 0) state.counts.delete(n);
    else state.counts.set(n, c);
    state.left++;
  }
}

const TOP_N = 10;

export function topNFromCounts(counts: ReadonlyMap<string, number>, n = TOP_N): { names: string[]; countsOut: number[] } {
  const sorted = Array.from(counts.entries())
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
  return {
    names: sorted.map(([name]) => name),
    countsOut: sorted.map(([, c]) => c),
  };
}

export type TopChannelsResult = {
  names: string[];
  channelToIndex: Map<string, number>;
};

/** Top N channels by watch count in the given events (same rules as Games — omits Takeout-only video rows). */
export function computeTopChannels(events: readonly WatchEvent[], topN: number): TopChannelsResult {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.channelName === CHANNEL_OMITTED_IN_EXPORT) continue;
    counts.set(e.channelName, (counts.get(e.channelName) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN);
  const names = sorted.map(([n]) => n);
  const channelToIndex = new Map(names.map((n, i) => [n, i] as const));
  return { names, channelToIndex };
}

type Milestone = { t: number; c: number };

/**
 * Sorted watch events restricted to known channel indices, plus row-major prefix counts:
 * prefix[(k * C) + c] = watches of channel c among the first k milestones.
 */
export function buildMilestonePrefix(
  events: readonly WatchEvent[],
  channelToIndex: ReadonlyMap<string, number>,
  channelCount: number
): { times: Float64Array; prefix: Uint32Array; milestoneCount: number } {
  const list: Milestone[] = [];
  for (const e of events) {
    const c = channelToIndex.get(e.channelName);
    if (c === undefined) continue;
    list.push({ t: e.watchedAt.getTime(), c });
  }
  list.sort((a, b) => a.t - b.t);
  const M = list.length;
  const times = new Float64Array(M);
  const prefix = new Uint32Array((M + 1) * channelCount);
  for (let k = 0; k < M; k++) {
    times[k] = list[k]!.t;
    const from = k * channelCount;
    const to = (k + 1) * channelCount;
    for (let c = 0; c < channelCount; c++) {
      prefix[to + c] = prefix[from + c]! + (list[k]!.c === c ? 1 : 0);
    }
  }
  return { times, prefix, milestoneCount: M };
}

/** Number of milestones with time <= T (times sorted ascending). */
export function countMilestonesAtOrBefore(times: Float64Array, T: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid]! <= T) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function readCounts(prefix: Uint32Array, channelCount: number, milestoneIdx: number, out: number[]): void {
  const base = milestoneIdx * channelCount;
  for (let c = 0; c < channelCount; c++) {
    out[c] = prefix[base + c]!;
  }
}

const BAR_HUES = [12, 38, 168, 210, 280, 145, 32, 330, 195, 265];

export function channelBarColor(channelIndex: number, alpha = 1): string {
  const h = BAR_HUES[channelIndex % BAR_HUES.length]!;
  const s = 72;
  const l = 52;
  if (alpha >= 1) return `hsl(${h} ${s}% ${l}%)`;
  return `hsla(${h} ${s}% ${l}% / ${alpha})`;
}

/** Stable bar color for a channel name (rolling mode where rank set changes). */
export function channelBarColorFromName(name: string, alpha = 1): string {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)!;
    h = Math.imul(h, 16777619);
  }
  const idx = (h >>> 0) % BAR_HUES.length;
  return channelBarColor(idx, alpha);
}

export function pickWebmMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}
