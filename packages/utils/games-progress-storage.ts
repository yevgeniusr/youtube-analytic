import type { GameDifficulty, GameKind } from '@/lib/games-types';

export const GAMES_PROGRESS_STORAGE_KEY = 'viewpulse-games-progress';

export type GamesProgressScore = { correct: number; played: number };

/** History check: cumulative points and rounds played (points scale with guess accuracy). */
export type GamesProgressHistoryDuel = { totalPoints: number; rounds: number };

export type GamesProgressV1 = {
  v: 1;
  difficulty: GameDifficulty;
  tab: GameKind;
  scores: {
    channels: GamesProgressScore;
    rewatch: GamesProgressScore;
    historyDuel: GamesProgressHistoryDuel;
  };
  /** How often each channel-duel id was shown (A and B both +1 per round). */
  exposureChannels?: Record<string, number>;
  /** Same for rewatch duel ids. */
  exposureRewatch?: Record<string, number>;
  /** Per-video id for History check weighted picks. */
  exposureHistoryDuel?: Record<string, number>;
};

export function defaultGamesScores(): GamesProgressV1['scores'] {
  return {
    channels: { correct: 0, played: 0 },
    rewatch: { correct: 0, played: 0 },
    historyDuel: { totalPoints: 0, rounds: 0 },
  };
}

function isDifficulty(v: unknown): v is GameDifficulty {
  return v === 'easy' || v === 'medium' || v === 'hard';
}

function isTab(v: unknown): v is GameKind {
  return v === 'channels' || v === 'rewatch' || v === 'history';
}

function clampHistoryDuel(v: unknown): GamesProgressHistoryDuel {
  if (typeof v !== 'object' || v === null) return { totalPoints: 0, rounds: 0 };
  const o = v as Record<string, unknown>;
  const totalPoints =
    typeof o.totalPoints === 'number' && Number.isFinite(o.totalPoints)
      ? Math.max(0, Math.floor(o.totalPoints))
      : 0;
  const rounds =
    typeof o.rounds === 'number' && Number.isFinite(o.rounds) ? Math.max(0, Math.floor(o.rounds)) : 0;
  return { totalPoints, rounds };
}

function clampScore(s: unknown): GamesProgressScore {
  if (typeof s !== 'object' || s === null) return { correct: 0, played: 0 };
  const o = s as Record<string, unknown>;
  const correct = typeof o.correct === 'number' && Number.isFinite(o.correct) ? Math.max(0, Math.floor(o.correct)) : 0;
  const played = typeof o.played === 'number' && Number.isFinite(o.played) ? Math.max(0, Math.floor(o.played)) : 0;
  return { correct, played: Math.max(played, correct) };
}

const MAX_EXPOSURE_KEYS = 12_000;

function clampExposureMap(raw: unknown): Record<string, number> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k.length > 2048) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const n = Math.max(0, Math.min(1_000_000, Math.floor(v)));
    if (n > 0) out[k] = n;
    if (Object.keys(out).length >= MAX_EXPOSURE_KEYS) break;
  }
  return out;
}

export function normalizeGamesProgress(raw: unknown): GamesProgressV1 | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const difficulty = isDifficulty(o.difficulty) ? o.difficulty : 'medium';
  const tab = isTab(o.tab) ? o.tab : 'channels';
  const scoresIn = o.scores;
  const exposureChannels = clampExposureMap(o.exposureChannels) ?? {};
  const exposureRewatch = clampExposureMap(o.exposureRewatch) ?? {};
  const exposureHistoryDuel = clampExposureMap(o.exposureHistoryDuel) ?? {};
  if (typeof scoresIn !== 'object' || scoresIn === null) {
    return {
      v: 1,
      difficulty,
      tab,
      scores: defaultGamesScores(),
      exposureChannels,
      exposureRewatch,
      exposureHistoryDuel,
    };
  }
  const sc = scoresIn as Record<string, unknown>;
  return {
    v: 1,
    difficulty,
    tab,
    scores: {
      channels: clampScore(sc.channels),
      rewatch: clampScore(sc.rewatch),
      historyDuel: clampHistoryDuel(sc.historyDuel),
    },
    exposureChannels,
    exposureRewatch,
    exposureHistoryDuel,
  };
}

export function loadGamesProgress(): GamesProgressV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GAMES_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeGamesProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGamesProgress(state: GamesProgressV1): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GAMES_PROGRESS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode
  }
}

export function clearGamesProgressStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GAMES_PROGRESS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
