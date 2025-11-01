import { MarketSource, MarketStatus, TradeSide } from '@repo/database';

/**
 * Normalized market data
 */
export interface NormalizedMarket {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  endDate?: Date;
  status: MarketStatus;
  totalVolume?: number;
  totalLiquidity?: number;
  
  // Source-specific data
  source: MarketSource;
  sourceMarketId: string;
  tokenId?: string;
  clobTokenIds?: string[];
  volumeTier?: string;
  sourceData: any;
  
  // Outcomes
  outcomes: NormalizedOutcome[];
}

/**
 * Normalized market outcome
 */
export interface NormalizedOutcome {
  title: string;
  description?: string;
  index: number;
  currentPrice?: number;
  currentVolume?: number;
  currentLiquidity?: number;
}

/**
 * Normalized price data
 */
export interface NormalizedPrice {
  marketId: string;
  source: MarketSource;
  outcomeId?: string;
  outcomeIndex?: number;
  price: number;
  volume?: number;
  liquidity?: number;
  timestamp: Date;
}

/**
 * Normalized trade data
 */
export interface NormalizedTrade {
  source: MarketSource;
  sourceTradeId: string;
  sourceMarketId: string;
  traderId?: string;
  traderWallet?: string;
  side: TradeSide;
  outcomeIndex?: number;
  quantity: number;
  price: number;
  totalValue: number;
  executedAt: Date;
  sourceData: any;
}

/**
 * Normalized trader data
 */
export interface NormalizedTrader {
  source: MarketSource;
  sourceTraderId: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
  totalTrades: number;
  totalVolume: number;
  totalPnl: number;
  winRate?: number;
  avgReturn?: number;
  currentRank?: number;
  bestRank?: number;
  rankChange: number;
  lastActiveAt?: Date;
  firstTradeAt?: Date;
  lastTradeAt?: Date;
  sourceData: any;
}

