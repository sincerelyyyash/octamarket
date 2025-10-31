import { get } from "./client";
import { Trader, TraderStats, TraderFollower } from "../../types/trader";
import { Trade } from "../../types/trade";
import { ApiResponse, PaginationParams, SortParams } from "../../types/api";
import { MarketSource } from "../../types/market";

interface TradersQueryParams extends PaginationParams, SortParams {
  source?: MarketSource;
  allowCopyTrading?: boolean;
  isPublic?: boolean;
  search?: string;
}

interface TraderTradesQueryParams extends PaginationParams {
  marketId?: string;
  source?: string;
  side?: string;
  status?: string;
  isCopyTrade?: boolean;
  startDate?: string;
  endDate?: string;
}

export const tradersApi = {
  // Get traders list
  getTraders: (params?: TradersQueryParams): Promise<ApiResponse<Trader[]>> => {
    return get<Trader[]>("/api/traders", { params });
  },

  // Get specific trader
  getTraderById: (id: string): Promise<ApiResponse<Trader>> => {
    return get<Trader>(`/api/traders/${id}`);
  },

  // Get trader statistics
  getTraderStats: (id: string): Promise<ApiResponse<TraderStats>> => {
    return get<TraderStats>(`/api/traders/${id}/stats`);
  },

  // Get trader's trades
  getTraderTrades: (
    id: string,
    params?: TraderTradesQueryParams
  ): Promise<ApiResponse<Trade[]>> => {
    return get<Trade[]>(`/api/traders/${id}/trades`, { params });
  },

  // Get trader's followers
  getTraderFollowers: (
    id: string,
    params?: PaginationParams
  ): Promise<ApiResponse<TraderFollower[]>> => {
    return get<TraderFollower[]>(`/api/traders/${id}/followers`, { params });
  },

  // Get traders that this trader follows
  getTraderFollowing: (
    id: string,
    params?: PaginationParams
  ): Promise<ApiResponse<TraderFollower[]>> => {
    return get<TraderFollower[]>(`/api/traders/${id}/following`, { params });
  },

  // Get copy trading available traders
  getCopyTradingTraders: (
    params?: Pick<TradersQueryParams, "page" | "limit" | "source">
  ): Promise<ApiResponse<Trader[]>> => {
    return get<Trader[]>("/api/traders/copy-trading", { params });
  },
};
