import { CHANNEL_OMITTED_IN_EXPORT, WatchEvent } from './parser';

const TOP_CHANNEL_LIMIT = 50;
/** Shown in dashboard tile / compact AI context */
const MOST_REWATCHED_TILE_LIMIT = 20;
/** Rewatch duel can use every distinct rewatched title in range (cap for huge histories). */
const REWATCH_GAME_POOL_MAX = 2500;

export interface RewatchEntry {
  title: string;
  channelName: string;
  videoId?: string;
  count: number;
  lastWatchedAt: Date;
}

export interface AnalyticsResult {
  totalWatched: number;
  youtubeCount: number;
  musicCount: number;
  uniqueChannels: number;
  dateFrom: Date;
  dateTo: Date;
  daysSpan: number;
  avgPerDay: number;
  topChannels: Array<{ name: string; count: number; pct: number; url?: string }>;
  hourlyDist: number[];   // 24 values
  weekdayDist: number[];  // 7 values (Sun=0)
  monthlyTrend: Array<{ key: string; label: string; count: number }>;
  yearlyBreakdown: Array<{ year: number; count: number }>;
  topBingeDays: Array<{ dateLabel: string; count: number; topTitle: string }>;
  peakHour: number;
  peakDay: string;
  topYear: number;
  /** Longest run of consecutive local calendar days with ≥1 watch */
  dailyStreakBest: { days: number; endDateLabel: string };
  /** Consecutive days with activity ending on the last day in range (local) */
  dailyStreakCurrent: number;
  /** Weeks start Monday (local). Longest run of consecutive weeks with ≥1 watch */
  weeklyStreakBest: { weeks: number; endWeekLabel: string };
  /** Consecutive weeks with activity ending on the week of `dateTo` */
  weeklyStreakCurrent: number;
  /** Videos watched 2+ times; top titles for dashboard tile / exports (capped). */
  mostRewatched: RewatchEntry[];
  /** All distinct videos with 2+ plays in range (capped); for rewatch mini-game variety. */
  rewatchGamePool: RewatchEntry[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of the local calendar week containing `d` (ISO-style week) */
function mondayOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + offset);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondayKey(d: Date): string {
  return localDayKey(mondayOfWeek(d));
}

function dayKeysDeltaDays(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  const t1 = new Date(ya, ma - 1, da).getTime();
  const t2 = new Date(yb, mb - 1, db).getTime();
  return Math.round((t2 - t1) / 86400000);
}

function formatDayKeyLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function formatWeekRangeLabel(mondayKeyStr: string): string {
  const [y, m, d] = mondayKeyStr.split('-').map(Number);
  const mon = new Date(y, m - 1, d);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const endM = MONTHS[sun.getMonth()];
  const endD = sun.getDate();
  const endY = sun.getFullYear();
  return `${MONTHS[m - 1]} ${d} – ${endM} ${endD}, ${endY}`;
}

function longestConsecutiveDayStreak(sortedDayKeys: string[]): { length: number; endKey: string } {
  if (sortedDayKeys.length === 0) return { length: 0, endKey: '' };
  let best = 1;
  let cur = 1;
  let bestEnd = sortedDayKeys[0];
  for (let i = 1; i < sortedDayKeys.length; i++) {
    const prev = sortedDayKeys[i - 1];
    const curr = sortedDayKeys[i];
    if (dayKeysDeltaDays(prev, curr) === 1) {
      cur++;
      if (cur > best) {
        best = cur;
        bestEnd = curr;
      }
    } else {
      cur = 1;
    }
  }
  return { length: best, endKey: bestEnd };
}

function currentDayStreakEndingOn(sortedDayKeys: string[], endDayKey: string): number {
  const set = new Set(sortedDayKeys);
  if (!set.has(endDayKey)) return 0;
  let count = 0;
  let k = endDayKey;
  while (set.has(k)) {
    count++;
    const [y, m, d] = k.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    k = localDayKey(dt);
  }
  return count;
}

function prevMondayKey(mondayKeyStr: string): string {
  const [y, m, d] = mondayKeyStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 7);
  return localDayKey(dt);
}

function longestConsecutiveWeekStreak(sortedMondayKeys: string[]): { length: number; endKey: string } {
  if (sortedMondayKeys.length === 0) return { length: 0, endKey: '' };
  let best = 1;
  let cur = 1;
  let bestEnd = sortedMondayKeys[0];
  for (let i = 1; i < sortedMondayKeys.length; i++) {
    const prev = sortedMondayKeys[i - 1];
    const curr = sortedMondayKeys[i];
    if (dayKeysDeltaDays(prev, curr) === 7) {
      cur++;
      if (cur > best) {
        best = cur;
        bestEnd = curr;
      }
    } else {
      cur = 1;
    }
  }
  return { length: best, endKey: bestEnd };
}

function currentWeekStreakEndingOn(sortedMondayKeys: string[], endMondayKey: string): number {
  const set = new Set(sortedMondayKeys);
  if (!set.has(endMondayKey)) return 0;
  let count = 0;
  let k = endMondayKey;
  while (set.has(k)) {
    count++;
    k = prevMondayKey(k);
  }
  return count;
}

function emptyResult(): AnalyticsResult {
  const now = new Date();
  return {
    totalWatched: 0, youtubeCount: 0, musicCount: 0,
    uniqueChannels: 0, dateFrom: now, dateTo: now, daysSpan: 0, avgPerDay: 0,
    topChannels: [], hourlyDist: Array(24).fill(0), weekdayDist: Array(7).fill(0),
    monthlyTrend: [], yearlyBreakdown: [], topBingeDays: [],
    peakHour: 0, peakDay: 'Sunday', topYear: now.getFullYear(),
    dailyStreakBest: { days: 0, endDateLabel: '—' },
    dailyStreakCurrent: 0,
    weeklyStreakBest: { weeks: 0, endWeekLabel: '—' },
    weeklyStreakCurrent: 0,
    mostRewatched: [],
    rewatchGamePool: [],
  };
}

export function computeAnalytics(
  events: WatchEvent[],
  sourceFilter: 'youtube' | 'youtube-music' | 'all' = 'all'
): AnalyticsResult {
  const filtered =
    sourceFilter === 'all' ? events : events.filter((e) => e.source === sourceFilter);

  if (filtered.length === 0) return emptyResult();

  // ── Source counts (always from full filtered set, not re-filtered) ──
  const youtubeCount = filtered.filter((e) => e.source === 'youtube').length;
  const musicCount = filtered.filter((e) => e.source === 'youtube-music').length;

  // ── Channels (exclude Takeout placeholder — not a real channel) ──
  const channelMap = new Map<string, { count: number; url?: string }>();
  for (const event of filtered) {
    if (event.channelName === CHANNEL_OMITTED_IN_EXPORT) continue;
    const existing = channelMap.get(event.channelName);
    if (existing) {
      existing.count++;
    } else {
      channelMap.set(event.channelName, { count: 1, url: event.channelUrl });
    }
  }

  const sortedChannels = Array.from(channelMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP_CHANNEL_LIMIT);

  const maxChannelCount = sortedChannels[0]?.[1].count ?? 1;
  const topChannels = sortedChannels.map(([name, { count, url }]) => ({
    name,
    count,
    pct: Math.round((count / maxChannelCount) * 100),
    url,
  }));

  // ── Date range ──
  const sorted = filtered.slice().sort((a, b) => a.watchedAt.getTime() - b.watchedAt.getTime());
  const dateFrom = sorted[0].watchedAt;
  const dateTo = sorted[sorted.length - 1].watchedAt;
  const daysSpan = Math.max(
    1,
    Math.round((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24))
  );
  const avgPerDay = Math.round((filtered.length / daysSpan) * 10) / 10;

  // ── Distributions ──
  const hourlyDist = Array(24).fill(0);
  const weekdayDist = Array(7).fill(0);
  for (const event of filtered) {
    hourlyDist[event.watchedAt.getHours()]++;
    weekdayDist[event.watchedAt.getDay()]++;
  }

  // ── Monthly trend ──
  const monthMap = new Map<string, number>();
  for (const event of filtered) {
    const y = event.watchedAt.getFullYear();
    const m = event.watchedAt.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }
  const monthlyTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [y, m] = key.split('-');
      const label = `${MONTHS[parseInt(m) - 1]} '${y.slice(2)}`;
      return { key, label, count };
    });

  // ── Yearly breakdown ──
  const yearMap = new Map<number, number>();
  for (const event of filtered) {
    const year = event.watchedAt.getFullYear();
    yearMap.set(year, (yearMap.get(year) ?? 0) + 1);
  }
  const yearlyBreakdown = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, count]) => ({ year, count }));

  // ── Binge days ──
  const dayMap = new Map<string, { count: number; events: WatchEvent[] }>();
  for (const event of filtered) {
    const d = event.watchedAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const existing = dayMap.get(key);
    if (existing) {
      existing.count++;
      existing.events.push(event);
    } else {
      dayMap.set(key, { count: 1, events: [event] });
    }
  }

  const topBingeDays = Array.from(dayMap.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([key, { count, events: dayEvents }]) => {
      const [y, m, d] = key.split('-');
      const dateLabel = `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
      const topTitle = dayEvents[0]?.title ?? '';
      return { dateLabel, count, topTitle };
    });

  // ── Peak values ──
  const peakHour = hourlyDist.indexOf(Math.max(...hourlyDist));
  const peakDay = DAYS[weekdayDist.indexOf(Math.max(...weekdayDist))];
  const topYear =
    yearlyBreakdown.length > 0
      ? yearlyBreakdown.reduce((a, b) => (a.count > b.count ? a : b)).year
      : new Date().getFullYear();

  // ── Active local calendar days & Monday weeks ──
  const activeDays = new Set<string>();
  const activeWeeks = new Set<string>();
  for (const event of filtered) {
    const d = event.watchedAt;
    activeDays.add(localDayKey(d));
    activeWeeks.add(mondayKey(d));
  }
  const sortedDays = Array.from(activeDays).sort();
  const sortedWeeks = Array.from(activeWeeks).sort();

  const dayBest = longestConsecutiveDayStreak(sortedDays);
  const lastDayKey = localDayKey(dateTo);
  const dailyStreakCurrent = currentDayStreakEndingOn(sortedDays, lastDayKey);

  const weekBest = longestConsecutiveWeekStreak(sortedWeeks);
  const lastWeekKey = mondayKey(dateTo);
  const weeklyStreakCurrent = currentWeekStreakEndingOn(sortedWeeks, lastWeekKey);

  // ── Most rewatched (same videoId, or title+channel if no id) ──
  const rewatchMap = new Map<
    string,
    { title: string; channelName: string; videoId?: string; count: number; last: Date }
  >();
  for (const event of filtered) {
    const key = event.videoId ?? `t:${event.title}\0${event.channelName}`;
    const existing = rewatchMap.get(key);
    if (existing) {
      existing.count++;
      if (event.watchedAt > existing.last) existing.last = event.watchedAt;
    } else {
      rewatchMap.set(key, {
        title: event.title,
        channelName: event.channelName,
        videoId: event.videoId,
        count: 1,
        last: event.watchedAt,
      });
    }
  }
  const rewatchSorted = Array.from(rewatchMap.values())
    .filter((v) => v.count >= 2)
    .sort((a, b) => b.count - a.count || b.last.getTime() - a.last.getTime());

  const toRewatchEntry = (v: (typeof rewatchSorted)[number]): RewatchEntry => ({
    title: v.title,
    channelName: v.channelName,
    videoId: v.videoId,
    count: v.count,
    lastWatchedAt: v.last,
  });

  const mostRewatched = rewatchSorted.slice(0, MOST_REWATCHED_TILE_LIMIT).map(toRewatchEntry);
  const rewatchGamePool = rewatchSorted.slice(0, REWATCH_GAME_POOL_MAX).map(toRewatchEntry);

  return {
    totalWatched: filtered.length,
    youtubeCount,
    musicCount,
    uniqueChannels: channelMap.size,
    dateFrom,
    dateTo,
    daysSpan,
    avgPerDay,
    topChannels,
    hourlyDist,
    weekdayDist,
    monthlyTrend,
    yearlyBreakdown,
    topBingeDays,
    peakHour,
    peakDay,
    topYear,
    dailyStreakBest: {
      days: dayBest.length,
      endDateLabel: dayBest.endKey ? formatDayKeyLabel(dayBest.endKey) : '—',
    },
    dailyStreakCurrent,
    weeklyStreakBest: {
      weeks: weekBest.length,
      endWeekLabel: weekBest.endKey ? formatWeekRangeLabel(weekBest.endKey) : '—',
    },
    weeklyStreakCurrent,
    mostRewatched,
    rewatchGamePool,
  };
}
