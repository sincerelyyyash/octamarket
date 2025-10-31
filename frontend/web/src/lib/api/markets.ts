import { get } from './client';
import { Market, MarketOutcome, PriceHistoryPoint, MarketFilters } from '../../types/market';
import { ApiResponse, PaginationParams, SortParams } from '../../types/api';

interface MarketsQueryParams extends PaginationParams, SortParams, MarketFilters {}

export const marketsApi = {
  // Get markets list with filters
  getMarkets: (params?: MarketsQueryParams): Promise<ApiResponse<Market[]>> => {
    return get<Market[]>('/api/markets', { params });
  },

  // Get specific market by ID
  getMarketById: (id: string): Promise<ApiResponse<Market>> => {
    return get<Market>(`/api/markets/${id}`);
  },

  // Get market outcomes
  getMarketOutcomes: (id: string): Promise<ApiResponse<MarketOutcome[]>> => {
    return get<MarketOutcome[]>(`/api/markets/${id}/outcomes`);
  },

  // Get price history
  getPriceHistory: (
    id: string,
    params?: {
      outcomeId?: string;
      source?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<ApiResponse<PriceHistoryPoint[]>> => {
    return get<PriceHistoryPoint[]>(`/api/markets/${id}/price-history`, { params });
  },

  // Get active markets
  getActiveMarkets: (params?: PaginationParams): Promise<ApiResponse<Market[]>> => {
    return get<Market[]>('/api/markets/active', { params });
  },

  // Get trending markets
  getTrendingMarkets: (params?: PaginationParams): Promise<ApiResponse<Market[]>> => {
    return get<Market[]>('/api/markets/trending', { params });
  },

  // Get all categories
  getCategories: (): Promise<ApiResponse<string[]>> => {
    return get<string[]>('/api/markets/categories');
  },

  // Get all tags
  getTags: (): Promise<ApiResponse<string[]>> => {
    return get<string[]>('/api/markets/tags');
  },
};

