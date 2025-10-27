import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type { ArbitrageAlert, PaginationParams } from './types';

// Get arbitrage opportunities
export function useArbitrageOpportunities(
  params?: PaginationParams
): UseQueryResult<ArbitrageAlert[]> {
  return useQuery({
    queryKey: queryKeys.arbitrage.opportunities(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      return apiClient.get<ArbitrageAlert[]>(
        `/arbitrage/opportunities${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );
    },
    staleTime: 3000, // Arbitrage opportunities are time-sensitive
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}

// Get specific arbitrage opportunity
export function useArbitrageOpportunity(id: string): UseQueryResult<ArbitrageAlert> {
  return useQuery({
    queryKey: queryKeys.arbitrage.detail(id),
    queryFn: () => apiClient.get<ArbitrageAlert>(`/arbitrage/opportunities/${id}`),
    enabled: !!id,
    staleTime: 3000,
  });
}


