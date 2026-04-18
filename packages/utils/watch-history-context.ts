import type { AnalyticsResult } from './analytics';
import type { WatchEvent } from './parser';
import { CHANNEL_OMITTED_IN_EXPORT } from './parser';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type WatchHistoryContextPayload = {
  meta: {
    sourceFilter: 'all' | 'youtube' | 'youtube-music';
    rangeStartIso: string;
    rangeEndIso: string;
    generatedAtIso: string;
  };
  /** Volume and timing use all events in range; channel lists exclude rows without a channel name in Takeout. */
  dataScopeNote: string;
  summary: {
    totalWatched: number;
    youtubeCount: number;
    musicCount: number;
    youtubeSharePct: number;
    musicSharePct: number;
    daysSpan: number;
    avgPerDay: number;
    /** Channels that have a real name (excludes Takeout rows with only a video link). */
    uniqueNamedChannels: number;
    peakHourLabel: string;
    peakWeekday: string;
    topYear: number;
    dailyStreakBestDays: number;
    dailyStreakBestEnded: string;
    dailyStreakCurrent: number;
    weeklyStreakBestWeeks: number;
    weeklyStreakCurrent: number;
  };
  timeOfDay: {
    hourly: Array<{ hour: number; label: string; count: number }>;
    peakHour: number;
    quietestHours: Array<{ hour: number; label: string; count: number }>;
  };
  dayOfWeek: {
    byWeekday: Array<{ weekday: string; count: number; sharePct: number }>;
    weekendVsWeekday: { weekendCount: number; weekdayCount: number; weekendSharePct: number };
  };
  channels: {
    topNamedChannels: Array<{ name: string; count: number; pctWithinTop20: number }>;
  };
  monthly: {
    byMonth: Array<{ label: string; count: number }>;
    busiestMonths: Array<{ label: string; count: number }>;
    quietestMonths: Array<{ label: string; count: number }>;
  };
  yearly: {
    byYear: Array<{ year: number; count: number }>;
    mostActiveYear: number;
    yearOverYear: Array<{ fromYear: number; toYear: number; changePct: number | null }>;
  };
  bingeDays: Array<{ dateLabel: string; count: number; topTitle: string }>;
  rewatches: Array<{ title: string; channelName: string; count: number }>;
  titleKeywords: Array<{ word: string; count: number }>;
  /** Cross-metric bullets for the model; no export-gap or missing-channel wording. */
  derivedInsights: string[];
};

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function isNamedChannel(name: string): boolean {
  return name !== CHANNEL_OMITTED_IN_EXPORT;
}

function topNamedChannelsFromEvents(events: WatchEvent[], limit: number) {
  const map = new Map<string, number>();
  for (const e of events) {
    if (!isNamedChannel(e.channelName)) continue;
    map.set(e.channelName, (map.get(e.channelName) ?? 0) + 1);
  }
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = sorted[0]?.[1] ?? 1;
  return sorted.map(([name, count]) => ({
    name,
    count,
    pctWithinTop20: Math.round((count / max) * 100),
  }));
}

function uniqueNamedChannelCount(events: WatchEvent[]): number {
  const set = new Set<string>();
  for (const e of events) {
    if (isNamedChannel(e.channelName)) set.add(e.channelName);
  }
  return set.size;
}

function buildDerivedInsights(a: AnalyticsResult): string[] {
  const out: string[] = [];
  const total = Math.max(1, a.totalWatched);
  const weekend = a.weekdayDist[0] + a.weekdayDist[6];
  const weekdaySum = total - weekend;
  const weekendPct = Math.round((weekend / total) * 100);
  if (weekendPct >= 55) {
    out.push(`Weekend-heavy rhythm: about ${weekendPct}% of watches fall on Saturday–Sunday.`);
  } else if (weekdaySum > 0 && Math.round((weekdaySum / total) * 100) >= 60) {
    out.push(`Weekday-heavy rhythm: most watching happens Mon–Fri in this range.`);
  } else {
    out.push(`Weekday vs weekend is relatively balanced (~${100 - weekendPct}% weekday, ${weekendPct}% weekend).`);
  }

  const h = a.peakHour;
  const period =
    h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'late night';
  out.push(`Strongest hour-of-day cluster peaks at ${hourLabel(h)} (${period}).`);

  const yt = a.youtubeCount;
  const mu = a.musicCount;
  if (yt > 0 && mu > 0) {
    const yp = Math.round((yt / total) * 100);
    const mp = Math.round((mu / total) * 100);
    out.push(`YouTube video vs YouTube Music split is roughly ${yp}% / ${mp}% in this slice.`);
  } else if (mu === 0 && yt > 0) {
    out.push('This slice is effectively all standard YouTube (no YouTube Music plays).');
  } else if (yt === 0 && mu > 0) {
    out.push('This slice is effectively all YouTube Music.');
  }

  const topBinge = a.topBingeDays[0];
  if (topBinge && topBinge.count >= 8) {
    out.push(`High single-day volume: busiest day logged ${topBinge.count} plays (${topBinge.dateLabel}).`);
  } else if (topBinge && topBinge.count >= 4) {
    out.push(`Notable single-day peaks reach about ${topBinge.count} plays (e.g. ${topBinge.dateLabel}).`);
  }

  if (a.mostRewatched.length >= 3) {
    out.push(`Repeat viewing shows up often: ${a.mostRewatched.length}+ distinct titles were watched more than once.`);
  } else if (a.mostRewatched.length === 1) {
    out.push('There is at least one clearly repeat-watched title in this range.');
  }

  if (a.dailyStreakBest.days >= 14) {
    out.push(`Long daily activity streak: best run is ${a.dailyStreakBest.days} consecutive days with at least one watch.`);
  }

  const months = a.monthlyTrend;
  if (months.length >= 3) {
    const last3 = months.slice(-3);
    const avgLast = last3.reduce((s, m) => s + m.count, 0) / last3.length;
    const prev3 = months.slice(-6, -3);
    if (prev3.length === 3) {
      const avgPrev = prev3.reduce((s, m) => s + m.count, 0) / prev3.length;
      if (avgPrev > 0) {
        const ch = Math.round(((avgLast - avgPrev) / avgPrev) * 100);
        if (Math.abs(ch) >= 15) {
          out.push(
            ch > 0
              ? `Recent months are busier than the prior quarter (~${ch}% higher average monthly plays).`
              : `Recent months are quieter than the prior quarter (~${Math.abs(ch)}% lower average monthly plays).`
          );
        }
      }
    }
  }

  return out;
}

export function buildWatchHistoryContext(input: {
  analytics: AnalyticsResult;
  events: WatchEvent[];
  filter: 'all' | 'youtube' | 'youtube-music';
  startDate: Date;
  endDate: Date;
  topKeywords: Array<{ word: string; count: number }>;
}): WatchHistoryContextPayload {
  const { analytics: a, events, filter, startDate, endDate, topKeywords } = input;
  const total = Math.max(1, a.totalWatched);
  const yt = a.youtubeCount;
  const mu = a.musicCount;

  const hourly = a.hourlyDist.map((count, hour) => ({
    hour,
    label: hourLabel(hour),
    count,
  }));
  const sortedHours = [...hourly].sort((x, y) => x.count - y.count);
  const quietestHours = sortedHours.filter((x) => x.count > 0).slice(0, 3);

  const byWeekday = a.weekdayDist.map((count, i) => ({
    weekday: WEEKDAY_LABELS[i],
    count,
    sharePct: Math.round((count / total) * 100),
  }));
  const weekendCount = a.weekdayDist[0] + a.weekdayDist[6];
  const weekdayCount = total - weekendCount;

  const topNamed = topNamedChannelsFromEvents(events, 20);
  const monthlySorted = [...a.monthlyTrend].sort((x, y) => y.count - x.count);
  const busiestMonths = monthlySorted.slice(0, 5);
  const quietestMonths = [...monthlySorted].reverse().slice(0, 5).filter((m) => m.count > 0);

  const yearly = [...a.yearlyBreakdown].sort((x, y) => x.year - y.year);
  const yearOverYear: Array<{ fromYear: number; toYear: number; changePct: number | null }> = [];
  for (let i = 1; i < yearly.length; i++) {
    const prev = yearly[i - 1];
    const cur = yearly[i];
    const changePct =
      prev.count > 0 ? Math.round(((cur.count - prev.count) / prev.count) * 100) : null;
    yearOverYear.push({ fromYear: prev.year, toYear: cur.year, changePct });
  }

  const rewatches = a.mostRewatched
    .filter((r) => isNamedChannel(r.channelName))
    .slice(0, 15)
    .map((r) => ({ title: r.title, channelName: r.channelName, count: r.count }));

  const bingeDays = a.topBingeDays.slice(0, 8).map((b) => ({
    dateLabel: b.dateLabel,
    count: b.count,
    topTitle: b.topTitle,
  }));

  const derivedInsights = buildDerivedInsights(a);

  return {
    meta: {
      sourceFilter: filter,
      rangeStartIso: startDate.toISOString(),
      rangeEndIso: endDate.toISOString(),
      generatedAtIso: new Date().toISOString(),
    },
    dataScopeNote:
      'Channel rankings and rewatches list only include rows with a creator name in the export. Time-of-day, weekday, volume, streaks, and keywords use all rows in the selected range.',
    summary: {
      totalWatched: a.totalWatched,
      youtubeCount: yt,
      musicCount: mu,
      youtubeSharePct: Math.round((yt / total) * 100),
      musicSharePct: Math.round((mu / total) * 100),
      daysSpan: a.daysSpan,
      avgPerDay: a.avgPerDay,
      uniqueNamedChannels: uniqueNamedChannelCount(events),
      peakHourLabel: hourLabel(a.peakHour),
      peakWeekday: a.peakDay,
      topYear: a.topYear,
      dailyStreakBestDays: a.dailyStreakBest.days,
      dailyStreakBestEnded: a.dailyStreakBest.endDateLabel,
      dailyStreakCurrent: a.dailyStreakCurrent,
      weeklyStreakBestWeeks: a.weeklyStreakBest.weeks,
      weeklyStreakCurrent: a.weeklyStreakCurrent,
    },
    timeOfDay: {
      hourly,
      peakHour: a.peakHour,
      quietestHours,
    },
    dayOfWeek: {
      byWeekday,
      weekendVsWeekday: {
        weekendCount,
        weekdayCount,
        weekendSharePct: Math.round((weekendCount / total) * 100),
      },
    },
    channels: {
      topNamedChannels: topNamed,
    },
    monthly: {
      byMonth: a.monthlyTrend.map((m) => ({ label: m.label, count: m.count })),
      busiestMonths: busiestMonths.map((m) => ({ label: m.label, count: m.count })),
      quietestMonths: quietestMonths.map((m) => ({ label: m.label, count: m.count })),
    },
    yearly: {
      byYear: yearly.map((y) => ({ year: y.year, count: y.count })),
      mostActiveYear: a.topYear,
      yearOverYear,
    },
    bingeDays,
    rewatches,
    titleKeywords: topKeywords.slice(0, 48),
    derivedInsights,
  };
}

export function contextToPromptJson(ctx: WatchHistoryContextPayload): string {
  return JSON.stringify(ctx, null, 2);
}
