'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { RewatchEntry } from '@/lib/analytics';
import type { GameDifficulty, GameKind } from '@/lib/games-types';
import {
  clearGamesProgressStorage,
  defaultGamesScores,
  loadGamesProgress,
  saveGamesProgress,
  type GamesProgressScore,
} from '@/lib/games-progress-storage';
import { HistoryDuelGame } from '@/components/HistoryDuelGame';
import { mixSeed, randomUint32 } from '@/lib/random-uint32';
import type { WatchEvent } from '@/lib/parser';
import type { YoutubeOembedResult } from '@/lib/youtube-oembed';

export type ChannelGameStat = { name: string; count: number; url?: string; sampleVideoId?: string };

export type { GameDifficulty, GameKind } from '@/lib/games-types';

const DIFFICULTY_BLURB: Record<GameDifficulty, string> = {
  easy: 'Pairs are far apart in play count — usually easy to tell which side wins.',
  medium: 'Moderate gaps — still guessable, but you need a feel for your own habits.',
  hard: 'Counts are neck-and-neck — only a small margin separates the two.',
};

const HISTORY_DIFFICULTY_BLURB: Record<GameDifficulty, string> = {
  easy: 'Scoring is forgiving — rough timeline guesses still earn solid points.',
  medium: 'Points drop in proportion to how far your click is from your real first watch.',
  hard: 'Only clicks very close to your first watch score highly.',
};

/**
 * Repeat penalty: weight = 1 / (1 + timesShown) ** POWER.
 * Higher POWER = much less chance for options you have seen often (never hard-zero).
 * Example: 5 prior appearances ≈ ~80× lower weight than never shown; 10× ≈ hundreds× lower.
 */
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

type DuelItem = {
  id: string;
  title: string;
  sub?: string;
  count: number;
  /** Channel page (channel duel) */
  url?: string;
  /** Video watch page (rewatch duel) */
  href?: string;
  /** Any watch URL we can pass to oEmbed (rewatch: same as href; channel: sample video from history) */
  oembedWatchUrl?: string;
};

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickAnyTwoDistinct<T extends { id: string }>(
  items: T[],
  rand: () => number,
  exposure: Readonly<Record<string, number>>
): [T, T] | null {
  if (items.length < 2) return null;
  const w = (t: T) => itemSelectionWeight(t.id, exposure);
  const a = weightedPick(items, w, rand);
  if (!a) return null;
  const rest = items.filter((x) => x !== a);
  const b = weightedPick(rest, w, rand);
  if (!b) return null;
  return rand() < 0.5 ? [a, b] : [b, a];
}

function pickTwoDifferentFromPools<T extends { id: string }>(
  poolLo: T[],
  poolHi: T[],
  rand: () => number,
  exposure: Readonly<Record<string, number>>
): [T, T] | null {
  if (poolLo.length === 0 || poolHi.length === 0) return null;
  const wLo = (t: T) => itemSelectionWeight(t.id, exposure);
  const wHi = (t: T) => itemSelectionWeight(t.id, exposure);
  let a = weightedPick(poolLo, wLo, rand);
  if (!a) return null;
  let b: T | null = weightedPick(poolHi, wHi, rand);
  let tries = 0;
  while (a === b && tries++ < 80) {
    b = weightedPick(poolHi, wHi, rand);
    if (!b) break;
  }
  if (a === b || b === null) {
    const alt = poolHi.filter((x) => x !== a);
    if (alt.length === 0) return null;
    b = weightedPick(alt, wHi, rand);
    if (!b) return null;
  }
  return rand() < 0.5 ? [a, b] : [b, a];
}

function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}\n${idB}` : `${idB}\n${idA}`;
}

function buildCountTiers<T extends { count: number }>(items: T[]) {
  const countToItems = new Map<number, T[]>();
  for (const it of items) {
    const c = it.count;
    const arr = countToItems.get(c);
    if (arr) arr.push(it);
    else countToItems.set(c, [it]);
  }
  const U = Array.from(countToItems.keys()).sort((a, b) => a - b);
  let minTierGap = Infinity;
  for (let i = 0; i < U.length - 1; i++) {
    minTierGap = Math.min(minTierGap, U[i + 1]! - U[i]!);
  }
  return { countToItems, U, minTierGap };
}

/**
 * One stochastic draw: varied tier choices so we do not always lock onto global min/max
 * or a single tightest adjacent step (which caused repetitive matchups).
 */
function pickDuelPairSingle<T extends { count: number; id: string }>(
  items: T[],
  rand: () => number,
  difficulty: GameDifficulty,
  exposure: Readonly<Record<string, number>>
): [T, T] | null {
  if (items.length < 2) return null;

  const { countToItems, U, minTierGap } = buildCountTiers(items);
  if (U.length < 2) {
    return pickAnyTwoDistinct(items, rand, exposure);
  }

  const minC = U[0]!;
  const maxC = U[U.length - 1]!;
  const R = maxC - minC;
  const n = U.length;

  if (difficulty === 'easy') {
    // Sample from low third vs high third of distinct count tiers (not only absolute min/max).
    const lowSpan = Math.max(1, Math.ceil((n - 1) * 0.34));
    const highSpan = Math.max(1, Math.ceil((n - 1) * 0.34));
    const lowIdxMax = Math.min(n - 2, lowSpan - 1);
    const highIdxMin = Math.max(1, n - highSpan);

    for (let t = 0; t < 28; t++) {
      const iLo = Math.floor(rand() * (lowIdxMax + 1));
      const rangeHi = n - Math.max(iLo + 1, highIdxMin);
      if (rangeHi <= 0) continue;
      const iHi = Math.max(iLo + 1, highIdxMin) + Math.floor(rand() * rangeHi);
      if (iHi <= iLo || iHi >= n) continue;
      const cLo = U[iLo]!;
      const cHi = U[iHi]!;
      if (cLo >= cHi) continue;
      const poolLo = countToItems.get(cLo)!;
      const poolHi = countToItems.get(cHi)!;
      const pair = pickTwoDifferentFromPools(poolLo, poolHi, rand, exposure);
      if (pair) return pair;
    }
    const low = countToItems.get(minC)!;
    const high = countToItems.get(maxC)!;
    const pair = pickTwoDifferentFromPools(low, high, rand, exposure);
    if (pair) return pair;
    return pickAnyTwoDistinct(items, rand, exposure);
  }

  if (difficulty === 'hard') {
    // Allow the tightest step and the next-tightest consecutive gaps so more tier pairs compete.
    const consecGaps: number[] = [];
    for (let i = 0; i < U.length - 1; i++) {
      consecGaps.push(U[i + 1]! - U[i]!);
    }
    const sorted = Array.from(new Set(consecGaps)).sort((a, b) => a - b);
    const g1 = sorted[0]!;
    const g2 = sorted.find((x) => x > g1) ?? g1;
    const cap = rand() < 0.55 ? g1 : Math.min(g2, g1 * 3, Math.max(g1 + 1, Math.ceil(R * 0.04) + g1));

    const tierPairs: Array<[number, number]> = [];
    for (let i = 0; i < U.length - 1; i++) {
      const g = U[i + 1]! - U[i]!;
      if (g <= cap) tierPairs.push([U[i]!, U[i + 1]!]);
    }
    if (tierPairs.length === 0) {
      for (let i = 0; i < U.length - 1; i++) {
        if (U[i + 1]! - U[i]! === g1) tierPairs.push([U[i]!, U[i + 1]!]);
      }
    }
    const [cLo, cHi] = tierPairs[Math.floor(rand() * tierPairs.length)]!;
    const poolLo = countToItems.get(cLo)!;
    const poolHi = countToItems.get(cHi)!;
    const pair = pickTwoDifferentFromPools(poolLo, poolHi, rand, exposure);
    if (pair) return pair;
    return pickAnyTwoDistinct(items, rand, exposure);
  }

  // medium: prefer mid-band gaps; pick among several random tier-pair candidates for variety
  const tierGaps: Array<{ lo: number; hi: number; gap: number }> = [];
  for (let i = 0; i < U.length; i++) {
    for (let j = i + 1; j < U.length; j++) {
      tierGaps.push({ lo: U[i]!, hi: U[j]!, gap: U[j]! - U[i]! });
    }
  }

  const loTarget = Math.max(minTierGap, Math.floor(R * 0.18));
  const hiTarget = Math.max(loTarget, Math.ceil(R * 0.72));
  let cand = tierGaps.filter((t) => t.gap >= loTarget && t.gap <= hiTarget);
  if (cand.length === 0) {
    cand = tierGaps.filter(
      (t) => t.gap >= Math.max(1, Math.floor(R * 0.1)) && t.gap <= Math.max(1, Math.ceil(R * 0.9))
    );
  }
  if (cand.length === 0) {
    cand = tierGaps.filter((t) => t.gap > 0);
  }

  const k = Math.min(5, cand.length);
  const picks: (typeof cand)[number][] = [];
  for (let p = 0; p < k; p++) {
    picks.push(cand[Math.floor(rand() * cand.length)]!);
  }
  const t = picks[Math.floor(rand() * picks.length)]!;
  const poolA = countToItems.get(t.lo)!;
  const poolB = countToItems.get(t.hi)!;
  const pair = pickTwoDifferentFromPools(poolA, poolB, rand, exposure);
  if (pair) return pair;
  return pickAnyTwoDistinct(items, rand, exposure);
}

function pickDuelPairWithExclusion<T extends { count: number; id: string }>(
  items: T[],
  difficulty: GameDifficulty,
  exclude: ReadonlySet<string>,
  roundKey: number,
  seedBase: number,
  difficultyD: GameDifficulty,
  sessionSalt: number,
  roundSalt: number,
  exposure: Readonly<Record<string, number>>
): [T, T] | null {
  const MAX = 140;
  for (let attempt = 0; attempt < MAX; attempt++) {
    const rand = mulberry32(
      mixSeed(
        seedBase >>> 0,
        roundKey * 30_011,
        difficultySalt(difficultyD) * 50_491,
        attempt * 104_729,
        sessionSalt >>> 0,
        roundSalt >>> 0
      )
    );
    const pair = pickDuelPairSingle(items, rand, difficulty, exposure);
    if (!pair) return null;
    const [a, b] = pair;
    if (!exclude.has(pairKey(a.id, b.id))) return pair;
  }
  const rand = mulberry32(
    mixSeed(
      seedBase >>> 0,
      roundKey * 30_011,
      difficultySalt(difficultyD) * 50_491,
      888_887,
      sessionSalt >>> 0,
      roundSalt >>> 0,
      0xdeadbeef
    )
  );
  return pickDuelPairSingle(items, rand, difficulty, exposure);
}

function winnerSide(left: DuelItem, right: DuelItem): 'left' | 'right' | 'tie' {
  if (left.count > right.count) return 'left';
  if (right.count > left.count) return 'right';
  return 'tie';
}

function getOembedFetchUrl(item: DuelItem): string | null {
  const u = item.href ?? item.oembedWatchUrl;
  return u && u.length > 0 ? u : null;
}

function channelToDuel(ch: ChannelGameStat): DuelItem {
  const oembedWatchUrl = ch.sampleVideoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(ch.sampleVideoId)}`
    : undefined;
  return {
    id: `ch:${ch.name}`,
    title: ch.name,
    sub: 'Channel',
    count: ch.count,
    url: ch.url,
    oembedWatchUrl,
  };
}

function rewatchToDuel(r: RewatchEntry, idx: number): DuelItem {
  const id = r.videoId ?? `t:${r.title}\0${r.channelName}\0${idx}`;
  const href = r.videoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(r.videoId)}`
    : undefined;
  return {
    id,
    title: r.title,
    sub: r.channelName,
    count: r.count,
    href,
    oembedWatchUrl: href,
  };
}

type OembedEntry =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: YoutubeOembedResult }
  | { status: 'error' };

function useOembedForPair(left: DuelItem | null, right: DuelItem | null, roundKey: number) {
  const [byUrl, setByUrl] = useState<Record<string, OembedEntry>>({});

  useEffect(() => {
    if (!left || !right) return;
    const urls = [getOembedFetchUrl(left), getOembedFetchUrl(right)].filter(Boolean) as string[];
    if (urls.length === 0) return;

    const ac = new AbortController();

    for (const url of urls) {
      setByUrl((prev) => {
        if (prev[url]?.status === 'ok') return prev;
        return { ...prev, [url]: { status: 'loading' } };
      });

      fetch(`/api/youtube-oembed?url=${encodeURIComponent(url)}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: YoutubeOembedResult) => {
          setByUrl((prev) => ({ ...prev, [url]: { status: 'ok', data } }));
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setByUrl((prev) => {
            if (prev[url]?.status === 'ok') return prev;
            return { ...prev, [url]: { status: 'error' } };
          });
        });
    }

    return () => ac.abort();
  }, [left, right, roundKey]);

  return byUrl;
}

function DuelGuessCard({
  side,
  item,
  revealed,
  outcome,
  winnerSide: win,
  pickedSide,
  onPick,
  onKeyDown,
  oembedByUrl,
}: {
  side: 'left' | 'right';
  item: DuelItem;
  revealed: boolean;
  outcome: 'left' | 'right' | 'tie';
  winnerSide: 'left' | 'right' | 'tie';
  pickedSide: 'left' | 'right' | null;
  onPick: (side: 'left' | 'right') => void;
  onKeyDown: (e: KeyboardEvent) => void;
  oembedByUrl: Record<string, OembedEntry>;
}) {
  const fetchUrl = getOembedFetchUrl(item);
  const entry = fetchUrl ? oembedByUrl[fetchUrl] : undefined;
  const oembed = entry?.status === 'ok' ? entry.data : null;
  const loading = Boolean(fetchUrl && (!entry || entry.status === 'loading'));
  const failed = entry?.status === 'error';

  const isChannelCard = item.sub === 'Channel';
  const primaryHref = isChannelCard ? item.url : item.href;
  const headline = isChannelCard ? item.title : (oembed?.title ?? item.title);
  const metaLine = isChannelCard
    ? (oembed?.author_name ?? 'YouTube channel')
    : (oembed?.author_name ?? item.sub);

  const thumbUrl = oembed?.thumbnail_url;

  const isWinner = win === side || win === 'tie';
  const isPicked = pickedSide === side;

  return (
    <div
      role="button"
      tabIndex={revealed ? -1 : 0}
      aria-disabled={revealed}
      className={`guess-card${revealed && isWinner ? ' guess-card--winner' : ''}${isPicked ? ' guess-card--picked' : ''}`}
      onClick={() => !revealed && onPick(side)}
      onKeyDown={onKeyDown}
    >
      <span className="guess-card-label">{side === 'left' ? 'A' : 'B'}</span>

      <div className="guess-card-media">
        {loading ? (
          <div className="guess-card-thumb guess-card-thumb--skeleton" aria-hidden />
        ) : thumbUrl ? (
          <>
            {/* YouTube CDN URLs vary per video; plain img avoids next/image domain allowlists. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="guess-card-thumb"
              src={thumbUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </>
        ) : (
          <div className="guess-card-thumb guess-card-thumb--placeholder" aria-hidden>
            {item.title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="guess-card-body">
        <span className="guess-card-title">
          {primaryHref ? (
            <a href={primaryHref} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {headline}
            </a>
          ) : (
            headline
          )}
        </span>
        {metaLine && <span className="guess-card-meta">{metaLine}</span>}
        {failed && fetchUrl && (
          <span className="guess-card-oembed-fail">YouTube preview unavailable — names still come from your file.</span>
        )}
        {isChannelCard && thumbUrl && (
          <span className="guess-card-footnote">Preview frame from a video you watched in this range.</span>
        )}
        {revealed && <span className="guess-card-count">{item.count.toLocaleString()}× in range</span>}
        {!revealed && !thumbUrl && !loading && item.sub && item.sub !== 'Channel' && (
          <span className="guess-card-sub">{item.sub}</span>
        )}
      </div>
    </div>
  );
}

function difficultySalt(d: GameDifficulty): number {
  if (d === 'easy') return 1;
  if (d === 'medium') return 2;
  return 3;
}

function GuessDuel({
  emptyMessage,
  items,
  seedBase,
  difficulty,
  score,
  onScoreDelta,
  progressEpoch,
  exposureById,
  onRecordPairExposure,
}: {
  emptyMessage: string;
  items: DuelItem[];
  seedBase: number;
  difficulty: GameDifficulty;
  score: GamesProgressScore;
  onScoreDelta: (d: { correct: 0 | 1; played: 0 | 1 }) => void;
  progressEpoch: number;
  exposureById: Readonly<Record<string, number>>;
  onRecordPairExposure: (idA: string, idB: string) => void;
}) {
  const [roundKey, setRoundKey] = useState(0);
  const [revealed, setRevealed] = useState<'left' | 'right' | null>(null);
  const [recentPairKeys, setRecentPairKeys] = useState<string[]>([]);
  const [sessionSalt] = useState(() => randomUint32());
  const [roundSalt, setRoundSalt] = useState(() => randomUint32());
  const skipFirstDifficultyEffect = useRef(true);
  const prevEpoch = useRef(progressEpoch);
  const exposureRef = useRef(exposureById);
  exposureRef.current = exposureById;
  const exposureLoggedRef = useRef('');

  const { left, right } = useMemo(() => {
    const raw = pickDuelPairWithExclusion(
      items,
      difficulty,
      new Set(recentPairKeys),
      roundKey,
      seedBase,
      difficulty,
      sessionSalt,
      roundSalt,
      exposureRef.current
    );
    if (!raw) return { left: null as DuelItem | null, right: null as DuelItem | null };
    const [a, b] = raw;
    const flipRand = mulberry32(
      mixSeed(
        seedBase >>> 0,
        roundKey * 977,
        difficultySalt(difficulty) * 7919,
        sessionSalt >>> 0,
        roundSalt >>> 0,
        2_000_003
      )
    );
    const flip = flipRand() < 0.5;
    return { left: flip ? b : a, right: flip ? a : b };
  }, [items, difficulty, roundKey, seedBase, recentPairKeys, sessionSalt, roundSalt]);

  const outcome = left && right ? winnerSide(left, right) : 'tie';

  const oembedByUrl = useOembedForPair(left, right, roundKey);

  useEffect(() => {
    if (!left || !right) return;
    const sig = `${roundKey}:${left.id}:${right.id}`;
    if (exposureLoggedRef.current === sig) return;
    exposureLoggedRef.current = sig;
    onRecordPairExposure(left.id, right.id);
  }, [left, right, roundKey, onRecordPairExposure]);

  useEffect(() => {
    if (skipFirstDifficultyEffect.current) {
      skipFirstDifficultyEffect.current = false;
      return;
    }
    setRecentPairKeys([]);
    setRoundSalt(randomUint32());
    setRevealed(null);
    setRoundKey((k) => k + 1);
  }, [difficulty]);

  useEffect(() => {
    if (prevEpoch.current !== progressEpoch) {
      prevEpoch.current = progressEpoch;
      setRecentPairKeys([]);
      setRoundSalt(randomUint32());
      setRevealed(null);
      setRoundKey(0);
    }
  }, [progressEpoch]);

  const onPick = useCallback(
    (side: 'left' | 'right') => {
      if (!left || !right || revealed) return;
      setRevealed(side);
      let correct = false;
      if (outcome === 'tie') {
        correct = true;
      } else {
        correct = outcome === side;
      }
      onScoreDelta({
        correct: correct ? 1 : 0,
        played: outcome === 'tie' ? 0 : 1,
      });
    },
    [left, right, revealed, outcome, onScoreDelta]
  );

  const nextRound = useCallback(() => {
    if (left && right) {
      setRecentPairKeys((prev) => [...prev, pairKey(left.id, right.id)].slice(-24));
    }
    setRoundSalt(randomUint32());
    setRevealed(null);
    setRoundKey((k) => k + 1);
  }, [left, right]);

  if (items.length < 2) {
    return <p className="games-empty">{emptyMessage}</p>;
  }

  if (!left || !right) {
    return <p className="games-empty">Could not pick a pair — try again.</p>;
  }

  const pickedCorrect = Boolean(revealed && (outcome === 'tie' || outcome === revealed));

  const cardKeyActivate = (side: 'left' | 'right') => (e: KeyboardEvent) => {
    if (revealed) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(side);
    }
  };

  return (
    <div className="guess-duel">
      <p className="games-duel-hint">Which did you watch more often in this range?</p>
      <div className="guess-duel-cards">
        <DuelGuessCard
          side="left"
          item={left}
          revealed={!!revealed}
          outcome={outcome}
          winnerSide={outcome}
          pickedSide={revealed}
          onPick={onPick}
          onKeyDown={cardKeyActivate('left')}
          oembedByUrl={oembedByUrl}
        />
        <DuelGuessCard
          side="right"
          item={right}
          revealed={!!revealed}
          outcome={outcome}
          winnerSide={outcome}
          pickedSide={revealed}
          onPick={onPick}
          onKeyDown={cardKeyActivate('right')}
          oembedByUrl={oembedByUrl}
        />
      </div>

      <div className="guess-duel-result">
        <p
          className="guess-duel-result-message"
          aria-hidden={!revealed}
          {...(revealed ? { 'aria-live': 'polite' as const } : {})}
        >
          {revealed &&
            (outcome === 'tie' ? (
              <>
                <strong>Tie</strong> — same number of plays.
              </>
            ) : (
              <>
                {pickedCorrect ? <strong>Correct.</strong> : <strong>Not quite.</strong>}{' '}
                {outcome === 'left' ? (
                  <>
                    <em>A</em> was higher ({left.count.toLocaleString()} vs {right.count.toLocaleString()}).
                  </>
                ) : (
                  <>
                    <em>B</em> was higher ({right.count.toLocaleString()} vs {left.count.toLocaleString()}).
                  </>
                )}
              </>
            ))}
        </p>
        <button
          type="button"
          className="db-reset-btn games-next-btn"
          disabled={!revealed}
          onClick={nextRound}
        >
          Next round
        </button>
      </div>

      <p className="games-score" aria-live="polite">
        Score: {score.correct} / {score.played}
        {score.played > 0 && ` (${Math.round((score.correct / score.played) * 100)}%)`}
      </p>
    </div>
  );
}

export function DashboardGames({
  channelStats,
  rewatchList,
  sourceEvents,
  rangeStart,
  rangeEnd,
  seedBase,
}: {
  channelStats: ChannelGameStat[];
  rewatchList: RewatchEntry[];
  sourceEvents: WatchEvent[];
  rangeStart: Date;
  rangeEnd: Date;
  /** Per-session salt so pairs vary across reloads */
  seedBase: number;
}) {
  const [tab, setTab] = useState<GameKind>('channels');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('medium');
  const [scores, setScores] = useState(defaultGamesScores);
  const [exposureChannels, setExposureChannels] = useState<Record<string, number>>({});
  const [exposureRewatch, setExposureRewatch] = useState<Record<string, number>>({});
  const [exposureHistoryDuel, setExposureHistoryDuel] = useState<Record<string, number>>({});
  const [storageReady, setStorageReady] = useState(false);
  const [progressEpoch, setProgressEpoch] = useState(0);

  const channelItems = useMemo(() => channelStats.map(channelToDuel), [channelStats]);
  const rewatchItems = useMemo(() => rewatchList.map(rewatchToDuel), [rewatchList]);

  useEffect(() => {
    const saved = loadGamesProgress();
    if (saved) {
      setDifficulty(saved.difficulty);
      setTab(saved.tab);
      setScores(saved.scores);
      setExposureChannels(saved.exposureChannels ?? {});
      setExposureRewatch(saved.exposureRewatch ?? {});
      setExposureHistoryDuel(saved.exposureHistoryDuel ?? {});
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveGamesProgress({
      v: 1,
      difficulty,
      tab,
      scores,
      exposureChannels,
      exposureRewatch,
      exposureHistoryDuel,
    });
  }, [storageReady, difficulty, tab, scores, exposureChannels, exposureRewatch, exposureHistoryDuel]);

  const bumpChannelScore = useCallback((d: { correct: 0 | 1; played: 0 | 1 }) => {
    setScores((prev) => ({
      ...prev,
      channels: {
        correct: prev.channels.correct + d.correct,
        played: prev.channels.played + d.played,
      },
    }));
  }, []);

  const bumpRewatchScore = useCallback((d: { correct: 0 | 1; played: 0 | 1 }) => {
    setScores((prev) => ({
      ...prev,
      rewatch: {
        correct: prev.rewatch.correct + d.correct,
        played: prev.rewatch.played + d.played,
      },
    }));
  }, []);

  const bumpHistoryDuelScore = useCallback((points: number) => {
    setScores((prev) => ({
      ...prev,
      historyDuel: {
        totalPoints: prev.historyDuel.totalPoints + points,
        rounds: prev.historyDuel.rounds + 1,
      },
    }));
  }, []);

  const recordChannelExposure = useCallback((a: string, b: string) => {
    setExposureChannels((prev) => ({
      ...prev,
      [a]: (prev[a] ?? 0) + 1,
      [b]: (prev[b] ?? 0) + 1,
    }));
  }, []);

  const recordRewatchExposure = useCallback((a: string, b: string) => {
    setExposureRewatch((prev) => ({
      ...prev,
      [a]: (prev[a] ?? 0) + 1,
      [b]: (prev[b] ?? 0) + 1,
    }));
  }, []);

  const recordHistoryDuelExposure = useCallback((id: string) => {
    setExposureHistoryDuel((prev) => ({
      ...prev,
      [id]: (prev[id] ?? 0) + 1,
    }));
  }, []);

  const resetSavedProgress = useCallback(() => {
    if (
      !window.confirm(
        'Reset all saved mini-game progress? Scores return to zero, difficulty to Medium, and the active game tab to Channel duel.'
      )
    ) {
      return;
    }
    const next = {
      v: 1 as const,
      difficulty: 'medium' as const,
      tab: 'channels' as const,
      scores: defaultGamesScores(),
      exposureChannels: {} as Record<string, number>,
      exposureRewatch: {} as Record<string, number>,
      exposureHistoryDuel: {} as Record<string, number>,
    };
    setDifficulty('medium');
    setTab('channels');
    setScores(next.scores);
    setExposureChannels({});
    setExposureRewatch({});
    setExposureHistoryDuel({});
    setProgressEpoch((e) => e + 1);
    clearGamesProgressStorage();
    saveGamesProgress(next);
  }, []);

  return (
    <div className="games-panel">
      <div className="games-difficulty-block">
        <span className="games-difficulty-label" id="games-difficulty-label">
          Difficulty
        </span>
        <div
          className="source-toggle games-difficulty-toggle"
          role="tablist"
          aria-labelledby="games-difficulty-label"
        >
          <button
            type="button"
            className={difficulty === 'easy' ? 'active' : ''}
            role="tab"
            aria-selected={difficulty === 'easy'}
            onClick={() => setDifficulty('easy')}
          >
            Easy
          </button>
          <button
            type="button"
            className={difficulty === 'medium' ? 'active' : ''}
            role="tab"
            aria-selected={difficulty === 'medium'}
            onClick={() => setDifficulty('medium')}
          >
            Medium
          </button>
          <button
            type="button"
            className={difficulty === 'hard' ? 'active' : ''}
            role="tab"
            aria-selected={difficulty === 'hard'}
            onClick={() => setDifficulty('hard')}
          >
            Hard
          </button>
        </div>
        <p className="games-difficulty-desc">
          {tab === 'history' ? HISTORY_DIFFICULTY_BLURB[difficulty] : DIFFICULTY_BLURB[difficulty]}
        </p>
        <div className="games-progress-actions">
          <button type="button" className="db-reset-btn games-reset-progress-btn" onClick={resetSavedProgress}>
            Reset saved progress
          </button>
          <span className="games-progress-hint">
            Scores, option frequency, and settings auto-save in this browser.
          </span>
        </div>
      </div>

      <div className="export-panel-tabs games-inner-tabs" role="tablist" aria-label="Games">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'channels'}
          className={`export-panel-tab${tab === 'channels' ? ' active' : ''}`}
          onClick={() => setTab('channels')}
        >
          Channel duel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rewatch'}
          className={`export-panel-tab${tab === 'rewatch' ? ' active' : ''}`}
          onClick={() => setTab('rewatch')}
        >
          Rewatch duel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={`export-panel-tab${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          History check
        </button>
      </div>
      <p className="games-blurb">
        Uses your current date range and All / YouTube / Music filter. Each round randomly samples eligible channels or
        videos; ones you have seen recently get lower (but never zero) weight so the deck feels fresher over time.
        Thumbnails and titles come from YouTube’s public oEmbed feed (proxied by this app, no API key). Only the watch
        URL is sent—never your full history file. History check uses the same range for the timeline and picks videos
        whose first watch in your filtered history falls inside that range.
      </p>
      {tab === 'channels' ? (
        <GuessDuel
          key="guess-channels"
          seedBase={seedBase}
          difficulty={difficulty}
          items={channelItems}
          score={scores.channels}
          onScoreDelta={bumpChannelScore}
          progressEpoch={progressEpoch}
          exposureById={exposureChannels}
          onRecordPairExposure={recordChannelExposure}
          emptyMessage="Need at least two channels with names in this range. Many rows only include a video link (no channel in Takeout)."
        />
      ) : tab === 'rewatch' ? (
        <GuessDuel
          key="guess-rewatch"
          seedBase={seedBase + 10_000}
          difficulty={difficulty}
          items={rewatchItems}
          score={scores.rewatch}
          onScoreDelta={bumpRewatchScore}
          progressEpoch={progressEpoch}
          exposureById={exposureRewatch}
          onRecordPairExposure={recordRewatchExposure}
          emptyMessage="No rewatched videos in this range — nothing was played more than once."
        />
      ) : (
        <HistoryDuelGame
          key="history-duel"
          sourceEvents={sourceEvents}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          seedBase={seedBase + 20_000}
          difficulty={difficulty}
          score={scores.historyDuel}
          onRoundScore={bumpHistoryDuelScore}
          progressEpoch={progressEpoch}
          exposureById={exposureHistoryDuel}
          onRecordExposure={recordHistoryDuelExposure}
        />
      )}
    </div>
  );
}
