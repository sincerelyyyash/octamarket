import { post, del, patch, get } from './client';
import {
  CopyTradingFollow,
  FollowTraderRequest,
  UpdateCopySettingsRequest,
  CopyTradingStats,
} from '../../types/copyTrading';
import { ApiResponse, PaginationParams } from '../../types/api';

export const copyTradingApi = {
  // Follow a trader
  followTrader: (data: FollowTraderRequest): Promise<ApiResponse<CopyTradingFollow>> => {
    return post<CopyTradingFollow>('/api/copy-trading/follow', data);
  },

  // Unfollow a trader
  unfollowTrader: (traderId: string): Promise<ApiResponse<void>> => {
    return del<void>(`/api/copy-trading/unfollow/${traderId}`);
  },

  // Update copy trading settings
  updateCopySettings: (
    followId: string,
    data: UpdateCopySettingsRequest
  ): Promise<ApiResponse<CopyTradingFollow>> => {
    return patch<CopyTradingFollow>(`/api/copy-trading/settings/${followId}`, data);
  },

  // Get my follows
  getMyFollows: (params?: PaginationParams): Promise<ApiResponse<CopyTradingFollow[]>> => {
    return get<CopyTradingFollow[]>('/api/copy-trading/my-follows', { params });
  },

  // Get copy trading stats
  getCopyTradingStats: (): Promise<ApiResponse<CopyTradingStats>> => {
    return get<CopyTradingStats>('/api/copy-trading/stats');
  },
};

