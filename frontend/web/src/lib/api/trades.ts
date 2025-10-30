import { post, get } from './client';
import {
  CreateTradeRequest,
  CreateTradeResponse,
  TradeIntentStatus,
  Trade,
} from '../../types/trade';
import { ApiResponse } from '../../types/api';

export const tradesApi = {
  // Create trade intent
  createTrade: (
    data: CreateTradeRequest,
    idempotencyKey?: string
  ): Promise<ApiResponse<CreateTradeResponse>> => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
    return post<CreateTradeResponse>('/api/trades', data, { headers });
  },

  // Get trade status
  getTradeStatus: (intentId: string): Promise<ApiResponse<TradeIntentStatus>> => {
    return get<TradeIntentStatus>(`/api/trades/${intentId}/status`);
  },

  // Get recent trades
  getRecentTrades: (limit?: number): Promise<ApiResponse<Trade[]>> => {
    return get<Trade[]>('/api/trades/recent/list', { params: { limit } });
  },

  // Get SSE stream URL for trade updates
  getTradeStreamUrl: (intentId: string): string => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/api/trades/${intentId}/stream`;
  },
};

