import { Trader } from './trader';

export interface CopyTradingFollow {
  id: string;
  followerId: string;
  followingId: string;
  autoCopyTrades: boolean;
  maxCopyAmount: number;
  copyPercentage: number;
  totalCopiedTrades: number;
  totalCopiedValue: number;
  totalCopiedPnl: number;
  createdAt: string;
  updatedAt: string;
  followingTrader?: Trader;
}

export interface FollowTraderRequest {
  traderId: string;
  autoCopyTrades: boolean;
  maxCopyAmount: number;
  copyPercentage: number;
}

export interface UpdateCopySettingsRequest {
  autoCopyTrades?: boolean;
  maxCopyAmount?: number;
  copyPercentage?: number;
}

export interface CopyTradingStats {
  overview: {
    followCount: number;
    totalCopiedTrades: number;
    totalCopiedValue: number;
    totalCopiedPnl: number;
  };
  recentCopiedTrades: Array<{
    id: string;
    trader: {
      id: string;
      username?: string;
      displayName?: string;
    };
    side: string;
    quantity: number;
    price: number;
    totalValue: number;
    realizedPnl?: number;
    executedAt: string;
  }>;
  generatedAt: string;
}

