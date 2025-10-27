import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type { AggregatedMarket, MarketSource, BestPrice, PaginationParams } from './types';

// Get all markets
export function useMarkets(params?: PaginationParams): UseQueryResult<AggregatedMarket[]> {
  return useQuery({
    queryKey: queryKeys.markets.list(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      return apiClient.get<AggregatedMarket[]>(
        `/markets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );
    },
    staleTime: 5000, // Consider data fresh for 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

// Get market sources for a specific event
export function useMarketSources(eventFingerprint: string): UseQueryResult<MarketSource[]> {
  return useQuery({
    queryKey: queryKeys.markets.sources(eventFingerprint),
    queryFn: () => apiClient.get<MarketSource[]>(`/markets/${eventFingerprint}/sources`),
    enabled: !!eventFingerprint,
    staleTime: 5000,
  });
}

// Get best price for a specific event
export function useBestPrice(eventFingerprint: string): UseQueryResult<BestPrice> {
  return useQuery({
    queryKey: queryKeys.markets.bestPrice(eventFingerprint),
    queryFn: () => apiClient.get<BestPrice>(`/markets/${eventFingerprint}/best-price`),
    enabled: !!eventFingerprint,
    staleTime: 2000, // Best prices change frequently
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}


