import { get } from './client';
import { PlatformStats, MarketStats, SourceStatsResponse } from "../../types/stats";
import { ApiResponse, PaginationParams, TimeframeFilter } from "../../types/api";
import { MarketSource } from "../../types/market";

export const statsApi = {
  // Get platform-wide statistics
  getPlatformStats: (timeframe?: TimeframeFilter): Promise<ApiResponse<PlatformStats>> => {
    return get<PlatformStats>("/api/stats/platform", { params: { timeframe } });
  },

  // Get market statistics
  getMarketStats: (params?: PaginationParams): Promise<ApiResponse<MarketStats>> => {
    return get<MarketStats>("/api/stats/markets", { params });
  },

  // Get per-source statistics
  getSourceStats: (timeframe?: TimeframeFilter): Promise<ApiResponse<SourceStatsResponse>> => {
    return get<SourceStatsResponse>("/api/stats/sources", { params: { timeframe } });
  },

  // Get trader statistics (if endpoint exists)
  getTraderStats: (params?: PaginationParams): Promise<ApiResponse<any>> => {
    return get("/api/stats/traders", { params });
  },

  // Get leaderboard statistics (if endpoint exists)
  getLeaderboardStats: (params?: {
    page?: number;
    limit?: number;
    source?: MarketSource;
  }): Promise<ApiResponse<any>> => {
    return get("/api/stats/leaderboard", { params });
  },
};

