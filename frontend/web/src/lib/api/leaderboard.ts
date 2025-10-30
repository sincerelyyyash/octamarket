import { get } from './client';
import { Trader, LeaderboardSnapshot } from '../../types/trader';
import { ApiResponse, PaginationParams, SortParams, TimeframeFilter } from '../../types/api';
import { MarketSource } from '../../types/market';

interface LeaderboardQueryParams extends PaginationParams, SortParams {
  source?: MarketSource;
  timeframe?: TimeframeFilter;
}

export const leaderboardApi = {
  // Get global leaderboard
  getLeaderboard: (params?: LeaderboardQueryParams): Promise<ApiResponse<Trader[]>> => {
    return get<Trader[]>('/api/leaderboard', { params });
  },

  // Get source-specific leaderboard
  getLeaderboardBySource: (
    source: MarketSource,
    params?: Omit<LeaderboardQueryParams, 'source'>
  ): Promise<ApiResponse<Trader[]>> => {
    return get<Trader[]>(`/api/leaderboard/${source}`, { params });
  },

  // Get top traders
  getTopTraders: (params?: LeaderboardQueryParams): Promise<ApiResponse<Trader[]>> => {
    return get<Trader[]>('/api/leaderboard/top', { params });
  },

  // Get rising traders
  getRisingTraders: (params?: LeaderboardQueryParams): Promise<ApiResponse<Trader[]>> => {
    return get<Trader[]>('/api/leaderboard/rising', { params });
  },

  // Get leaderboard snapshots
  getLeaderboardSnapshots: (params?: {
    source?: MarketSource;
    limit?: number;
  }): Promise<ApiResponse<LeaderboardSnapshot[]>> => {
    return get<LeaderboardSnapshot[]>('/api/leaderboard/snapshots', { params });
  },
};

