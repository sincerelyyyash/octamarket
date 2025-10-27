import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { apiClient } from './client';
import { queryKeys } from './query-keys';
import type { Order, PlaceOrderRequest, OrderResponse, PaginationParams } from './types';

// Get user's orders
export function useMyOrders(params?: PaginationParams): UseQueryResult<Order[]> {
  return useQuery({
    queryKey: queryKeys.orders.my(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      return apiClient.get<Order[]>(
        `/orders/my${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );
    },
    staleTime: 5000,
    refetchInterval: 10000,
  });
}

// Place order mutation
export function usePlaceOrder(): UseMutationResult<OrderResponse, Error, PlaceOrderRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: PlaceOrderRequest) => 
      apiClient.post<OrderResponse>('/orders/place', request),
    onSuccess: () => {
      // Invalidate orders queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

// Cancel order mutation
export function useCancelOrder(): UseMutationResult<{ success: boolean; message?: string }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => 
      apiClient.delete(`/orders/${orderId}/cancel`),
    onSuccess: () => {
      // Invalidate orders queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}


