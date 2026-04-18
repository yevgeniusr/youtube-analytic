import type { WatchHistoryContextPayload } from '@/lib/watch-history-context';

export const SHARE_STAT_IDS = [
  'totalWatched',
  'avgPerDay',
  'peakHour',
  'peakWeekday',
  'uniqueChannels',
  'topChannel',
  'top3Bars',
  'top10Channels',
  'monthlyViz',
  'hourlyViz',
  'ytMusicSplit',
  'topYear',
  'yearByYear',
  'yearOverYear',
  'dailyStreak',
  'weeklyStreak',
  'bingeDay',
  'bingeTop5',
  'mostRewatched',
  'keywordBubbles',
  'weekendVsWeekday',
  'quietestHours',
  'derivedInsights',
  'coverage',
] as const;

export type ShareStatId = (typeof SHARE_STAT_IDS)[number];

export const SHARE_STAT_LABELS: Record<ShareStatId, string> = {
  totalWatched: 'Total videos watched',
  avgPerDay: 'Average per day',
  peakHour: 'Peak hour',
  peakWeekday: 'Busiest weekday',
  uniqueChannels: 'Unique channels',
  topChannel: '#1 channel',
  top3Bars: 'Top 3 channels (bar chart)',
  top10Channels: 'Top 10 channels (ranked)',
  monthlyViz: 'Monthly activity (spark)',
  hourlyViz: '24h rhythm strip',
  ytMusicSplit: 'YouTube vs Music %',
  topYear: 'Most active year',
  yearByYear: 'Year-by-year volume',
  yearOverYear: 'Year-over-year % change',
  dailyStreak: 'Best daily streak',
  weeklyStreak: 'Weekly watch streaks',
  bingeDay: 'Busiest single day',
  bingeTop5: 'Top 5 busiest days',
  mostRewatched: 'Most rewatched titles',
  keywordBubbles: 'Title keyword bubbles',
  weekendVsWeekday: 'Weekend vs weekday split',
  quietestHours: 'Quietest viewing hours',
  derivedInsights: 'Cross-metric insight bullets',
  coverage: 'History window coverage',
};

/** Default picks for AI share poster / image-prompt highlight checkboxes. */
export const DEFAULT_SHARE_HIGHLIGHTS: ShareStatId[] = [
  'totalWatched',
  'weeklyStreak',
  'avgPerDay',
  'top10Channels',
  'yearByYear',
  'derivedInsights',
  'uniqueChannels',
  'dailyStreak',
  'keywordBubbles',
];

export function buildShareStatsBulletLines(
  context: WatchHistoryContextPayload,
  selected: ReadonlySet<ShareStatId>
): string[] {
  const lines: string[] = [];
  const {
    summary,
    meta,
    channels,
    monthly,
    yearly,
    bingeDays,
    timeOfDay,
    dayOfWeek,
    rewatches,
    titleKeywords,
    derivedInsights,
  } = context;
  const top = channels.topNamedChannels[0];

  if (selected.has('totalWatched')) {
    lines.push(`Total videos watched in range: ${summary.totalWatched.toLocaleString()}`);
  }
  if (selected.has('avgPerDay')) {
    lines.push(`Average watches per day: ${summary.avgPerDay}`);
  }
  if (selected.has('peakHour')) {
    lines.push(`Peak hour: ${summary.peakHourLabel}`);
  }
  if (selected.has('peakWeekday')) {
    lines.push(`Busiest weekday: ${summary.peakWeekday}`);
  }
  if (selected.has('uniqueChannels')) {
    lines.push(`Unique named channels: ${summary.uniqueNamedChannels.toLocaleString()}`);
  }
  if (selected.has('topChannel') && top) {
    lines.push(`#1 channel: "${top.name}" with ${top.count.toLocaleString()} watches`);
  }
  if (selected.has('top3Bars')) {
    const three = channels.topNamedChannels.slice(0, 3);
    three.forEach((c, i) => {
      lines.push(`Top ${i + 1} channel: "${c.name}" — ${c.count.toLocaleString()} watches`);
    });
  }
  if (selected.has('top10Channels')) {
    channels.topNamedChannels.slice(0, 10).forEach((c, i) => {
      lines.push(`#${i + 1} channel: "${c.name}" — ${c.count.toLocaleString()} watches`);
    });
  }
  if (selected.has('monthlyViz') && monthly.busiestMonths.length) {
    const b = monthly.busiestMonths.slice(0, 3).map((m) => `${m.label}: ${m.count}`).join('; ');
    lines.push(`Busiest months: ${b}`);
  }
  if (selected.has('hourlyViz')) {
    const h = timeOfDay.hourly.reduce((m, x) => (x.count > m.count ? x : m), timeOfDay.hourly[0]);
    if (h) lines.push(`Strongest hour slot in data: ${h.label} (${h.count.toLocaleString()} watches)`);
  }
  if (selected.has('ytMusicSplit')) {
    lines.push(
      `YouTube ${summary.youtubeSharePct}% vs YouTube Music ${summary.musicSharePct}% (within this slice)`
    );
  }
  if (selected.has('topYear')) {
    const yc = yearly.byYear.find((y) => y.year === summary.topYear)?.count;
    lines.push(
      `Most active year: ${summary.topYear}${yc != null ? ` (${yc.toLocaleString()} videos)` : ''}`
    );
  }
  if (selected.has('yearByYear')) {
    yearly.byYear.forEach((y) => {
      lines.push(`${y.year}: ${y.count.toLocaleString()} videos`);
    });
  }
  if (selected.has('yearOverYear')) {
    yearly.yearOverYear.forEach((yo) => {
      const pct = yo.changePct;
      lines.push(
        pct == null
          ? `${yo.fromYear} → ${yo.toYear}: change n/a`
          : `${yo.fromYear} → ${yo.toYear}: ${pct >= 0 ? '+' : ''}${pct}% videos`
      );
    });
  }
  if (selected.has('dailyStreak')) {
    lines.push(
      `Best daily streak: ${summary.dailyStreakBestDays} consecutive days (ended ${summary.dailyStreakBestEnded})`
    );
  }
  if (selected.has('weeklyStreak')) {
    lines.push(
      `Best weekly streak: ${summary.weeklyStreakBestWeeks} consecutive weeks with ≥1 watch · Current weekly streak: ${summary.weeklyStreakCurrent} week(s)`
    );
  }
  if (selected.has('bingeDay') && bingeDays[0]) {
    const b = bingeDays[0];
    lines.push(`Busiest day: ${b.dateLabel} — ${b.count} watches (top title: "${b.topTitle}")`);
  }
  if (selected.has('bingeTop5')) {
    bingeDays.slice(0, 5).forEach((b, i) => {
      lines.push(`Busy day ${i + 1}: ${b.dateLabel} — ${b.count} watches ("${b.topTitle}")`);
    });
  }
  if (selected.has('mostRewatched')) {
    rewatches.slice(0, 10).forEach((r, i) => {
      lines.push(
        `Rewatch ${i + 1}: "${r.title}" (${r.channelName}) ×${r.count}`
      );
    });
  }
  if (selected.has('keywordBubbles')) {
    titleKeywords.slice(0, 18).forEach((k) => {
      lines.push(`Keyword "${k.word}": ${k.count} title hits`);
    });
  }
  if (selected.has('weekendVsWeekday')) {
    const w = dayOfWeek.weekendVsWeekday;
    lines.push(
      `Weekend ${w.weekendSharePct}% (${w.weekendCount.toLocaleString()}) vs weekday ${100 - w.weekendSharePct}% (${w.weekdayCount.toLocaleString()})`
    );
  }
  if (selected.has('quietestHours')) {
    timeOfDay.quietestHours.forEach((h) => {
      lines.push(`Quiet hour (non-zero): ${h.label} — ${h.count.toLocaleString()} watches`);
    });
  }
  if (selected.has('derivedInsights')) {
    derivedInsights.slice(0, 6).forEach((t) => lines.push(`Insight: ${t}`));
  }
  if (selected.has('coverage')) {
    lines.push(`Date range: ${meta.rangeStartIso} → ${meta.rangeEndIso} (filter: ${meta.sourceFilter})`);
  }

  return lines.length ? lines : [`Total videos watched: ${summary.totalWatched.toLocaleString()}`];
}

function visualHintsForPoster(selected: ReadonlySet<ShareStatId>): string {
  const hints: string[] = [];
  if (selected.has('keywordBubbles')) {
    hints.push(
      'Include a word-cloud or bubble cluster: word area ~ relative frequency; use the coral/ink palette; no overlapping unreadable text.'
    );
  }
  if (selected.has('top10Channels') || selected.has('top3Bars')) {
    hints.push('Use a clean horizontal bar ranking for channel list(s); exact names and counts from the list above.');
  }
  if (selected.has('yearByYear') || selected.has('yearOverYear')) {
    hints.push(
      'Add a mini column/bar or spine chart for year-by-year counts and/or annotate YoY % changes near year transitions.'
    );
  }
  if (selected.has('weeklyStreak') || selected.has('dailyStreak')) {
    hints.push('Streak metrics can appear as badge-style callouts or calendar strip accents.');
  }
  if (selected.has('mostRewatched')) {
    hints.push('Rewatches: compact list or numbered cards with title + count (truncate long titles with ellipsis in the graphic).');
  }
  if (selected.has('bingeTop5') || selected.has('bingeDay')) {
    hints.push('Binge days: timeline ticks or stacked day cards with date + play count.');
  }
  if (selected.has('weekendVsWeekday')) {
    hints.push('Weekend vs weekday: donut, split bar, or two-column share graphic.');
  }
  if (selected.has('quietestHours')) {
    hints.push('Quiet hours: small annotation on a 24h dial or heat strip (low bars).');
  }
  if (selected.has('derivedInsights')) {
    hints.push(
      'Add an "Insights" strip with short paraphrases of the insight bullets (same meaning, tight copy; no new claims).'
    );
  }
  if (!hints.length) return '';
  return `

VISUAL LAYOUT HINTS (apply only where matching data was listed above):
${hints.map((h) => `• ${h}`).join('\n')}`;
}

export function buildAiSharePosterPrompt(
  context: WatchHistoryContextPayload,
  selected: ReadonlySet<ShareStatId>,
  aspect: '1x1' | '4x5' | '9x16',
  options?: {
    includeUserPortrait?: boolean;
    /** 1-based index when generating multiple variations */
    variationIndex?: number;
    variationCount?: number;
  }
): string {
  const bullets = buildShareStatsBulletLines(context, selected);
  const aspectHint =
    aspect === '1x1'
      ? 'square 1:1 composition'
      : aspect === '4x5'
        ? 'vertical 4:5 portrait for Instagram feed'
        : 'tall vertical 9:16 for Stories / Shorts';

  const portraitBlock = options?.includeUserPortrait
    ? `

PORTRAIT: The first attached image is the user’s own photo or avatar. Include them tastefully in the layout (e.g. circular headshot in a corner or hero strip), lightly stylized to match the infographic (same palette, subtle illustration edge or soft shadow). Keep it recognizable but not hyper-realistic; must not overpower the data.`
    : '';

  const vi = options?.variationIndex;
  const vc = options?.variationCount;
  const variationBlock =
    vi != null && vc != null && vc > 1
      ? `

VARIATION: This is variation ${vi} of ${vc}. Use a clearly different layout, hierarchy, or decorative motif from other variations (same data, fresh composition).`
      : '';

  const hints = visualHintsForPoster(selected);

  return `Create a single polished social-media infographic image (${aspectHint}).

SUBJECT: personal YouTube / YouTube Music watch statistics (privacy-safe — no real names of people, only channel names and counts as given).

STYLE: premium editorial / data viz — bold sans-serif typography, coral (#e52d27) and deep ink (#1b2026) accents, subtle noise texture, soft gradients, crisp geometric charts (bars, sparkline, donut or split bar). High contrast, legible at phone size. No watermarks except a tiny "ViewPulse" wordmark in a corner.

CRITICAL — use ONLY these exact facts as labeled numbers on the graphic (do not invent, round differently, or add metrics not listed):
${bullets.map((b) => `• ${b}`).join('\n')}

Layout: eye-catching title line like "My watch stats", then the selected metrics as big numbers with small labels, integrate simple chart shapes that reflect the same numbers. No screenshots, no UI chrome, no stock photos of laptops.${hints}${portraitBlock}${variationBlock}`;
}
