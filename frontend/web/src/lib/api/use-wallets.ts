import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type { UserWallet, ConnectWalletRequest } from './types';

// Get user's wallets
export function useMyWallets(): UseQueryResult<UserWallet[]> {
  return useQuery({
    queryKey: queryKeys.userWallets.my(),
    queryFn: () => apiClient.get<UserWallet[]>('/wallets/my'),
    staleTime: 60000, // Wallets don't change frequently
  });
}

// Connect wallet mutation
export function useConnectWallet(): UseMutationResult<UserWallet, Error, ConnectWalletRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ConnectWalletRequest) => 
      apiClient.post<UserWallet>('/wallets/connect', request),
    onSuccess: () => {
      // Invalidate wallet queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.userWallets.all });
    },
  });
}


