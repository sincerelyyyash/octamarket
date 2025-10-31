import { MarketSource } from './market';

export enum TradeSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum TradeStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  EXECUTED = 'EXECUTED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export interface TradeFill {
  qty: number;
  px: number;
  ts: string;
}

export interface TradeIntent {
  intentId: string;
  source: MarketSource;
  sourceMarketId: string;
  marketId: string;
  side: TradeSide;
  outcomeIndex?: number;
  quantity: number;
  limitPrice?: number;
  followerContext?: {
    originalTradeId?: string;
    followingId?: string;
  };
}

export interface TradeIntentStatus {
  intentId: string;
  status: TradeStatus;
  venue?: MarketSource | null;
  orderId?: string;
  avgPrice?: number;
  fills?: TradeFill[];
  reason?: string | null;
  error?: string | null;
  price?: number;
  submittedAt?: string;
  filledAt?: string | null;
  failedAt?: string | null;
}

export interface Trade {
  id: string;
  traderId: string;
  source: MarketSource;
  sourceTradeId: string;
  marketId?: string;
  sourceMarketId: string;
  side: TradeSide;
  outcomeIndex?: number;
  quantity: number;
  price: number;
  totalValue: number;
  status: TradeStatus;
  executedAt: string;
  realizedPnl?: number;
  unrealizedPnl?: number;
  isCopyTrade: boolean;
  originalTradeId?: string;
  copiedByTraderId?: string;
}

export interface CreateTradeRequest {
  intentId: string;
  source: MarketSource;
  sourceMarketId: string;
  marketId: string;
  side: TradeSide;
  outcomeIndex?: number;
  quantity: number;
  limitPrice?: number;
  followerContext?: {
    originalTradeId?: string;
    followingId?: string;
  };
}

export interface CreateTradeResponse {
  intentId: string;
  enqueuedId: string;
}

