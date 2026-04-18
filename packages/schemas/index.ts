export interface WatchHistoryEntry {
  title: string;
  channel: string;
  channelId?: string;
  watchTime: string;
  date: string;
  url: string;
  description?: string;
}

export interface ParsedWatchHistory {
  entries: WatchHistoryEntry[];
  totalVideos: number;
  dateRange: { start: string; end: string };
  channels: Set<string>;
}

export interface GameType {
  type: 'channel_duel' | 'rewatch_duel' | 'history_check';
  score: number;
  difficulty: 'easy' | 'medium' | 'hard';
  playedAt: string;
}

export interface GameProgress {
  games: Record<GameType['type'], GameType>;
  totalGamesPlayed: number;
}

export interface ChannelStats {
  channel: string;
  videoCount: number;
  totalWatchTime: string;
  percentage: number;
  category?: string;
}

export interface AnalyticsReport {
  topChannels: ChannelStats[];
  topVideos: WatchHistoryEntry[];
  rewatchRate: number;
  avgVideosPerDay: number;
  mostActiveHour: number;
  dateRange: { start: string; end: string };
}

export type AiFeature = 'recommendations' | 'personality' | 'export' | 'share_card';
