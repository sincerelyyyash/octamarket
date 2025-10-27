import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type { Leader, LeaderDetail, WalletLeaderboardEntry, WalletTrade, PaginationParams } from './types';

// Get all leaders
export function useLeaders(): UseQueryResult<Leader[]> {
  return useQuery({
    queryKey: queryKeys.leaders.list(),
    queryFn: () => apiClient.get<Leader[]>('/leaders'),
    staleTime: 30000, // Leader stats don't change that frequently
    refetchInterval: 60000, // Refetch every minute
  });
}

// Get leader details
export function useLeaderDetail(leaderId: string): UseQueryResult<LeaderDetail> {
  return useQuery({
    queryKey: queryKeys.leaders.detail(leaderId),
    queryFn: () => apiClient.get<LeaderDetail>(`/leaders/${leaderId}`),
    enabled: !!leaderId,
    staleTime: 30000,
  });
}

// Get wallet leaderboard
export function useWalletLeaderboard(
  params?: PaginationParams
): UseQueryResult<WalletLeaderboardEntry[]> {
  return useQuery({
    queryKey: queryKeys.walletLeaderboard.list(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      return apiClient.get<WalletLeaderboardEntry[]>(
        `/wallet-leaderboard${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

// Get wallet trades
export function useWalletTrades(
  walletAddress: string,
  params?: PaginationParams
): UseQueryResult<WalletTrade[]> {
  return useQuery({
    queryKey: queryKeys.walletTrades.list(walletAddress, params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      return apiClient.get<WalletTrade[]>(
        `/wallets/${walletAddress}/trades${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );
    },
    enabled: !!walletAddress,
    staleTime: 10000,
  });
}


