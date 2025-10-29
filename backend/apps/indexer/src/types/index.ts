import type { MarketSource, MarketStatus, EventType } from '@repo/database';

// Define trade-related enums locally since they're not exported from database package
export enum TradeSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum TradeStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

// Core interfaces for the indexer
export interface MarketData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  endDate?: Date;
  resolutionDate?: Date;
  status: MarketStatus;
  totalVolume?: number;
  totalLiquidity?: number;
  participantCount?: number;
  resolvedOutcome?: string;
  resolutionSource?: string;
  outcomes: OutcomeData[];
}

export interface OutcomeData {
  title: string;
  description?: string;
  index: number;
  currentPrice?: number;
  currentVolume?: number;
  currentLiquidity?: number;
  isWinning?: boolean;
}

export interface MarketEventData {
  marketId: string;
  source: MarketSource;
  eventType: EventType;
  timestamp: Date;
  data: Record<string, any>;
  rawPayload: Record<string, any>;
}

export interface PriceData {
  marketId: string;
  outcomeId?: string;
  source: MarketSource;
  price: number;
  volume?: number;
  liquidity?: number;
  timestamp: Date;
}

// Leaderboard and Trader interfaces
export interface TraderData {
  id: string;
  source: MarketSource;
  sourceTraderId: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
  
  // Performance metrics
  totalTrades: number;
  totalVolume: number;
  totalPnl: number;
  winRate?: number;
  avgReturn?: number;
  
  // Rankings
  currentRank?: number;
  bestRank?: number;
  rankChange?: number;
  
  // Activity tracking
  lastActiveAt?: Date;
  firstTradeAt?: Date;
  lastTradeAt?: Date;
  
  // Copy trading settings
  isPublic: boolean;
  allowCopyTrading: boolean;
  maxFollowers?: number;
  
  // Metadata
  sourceData?: Record<string, any>;
}

export interface TradeData {
  id: string;
  traderId: string;
  source: MarketSource;
  sourceTradeId: string;
  
  // Market information
  marketId?: string;
  sourceMarketId: string;
  
  // Trade details
  side: TradeSide;
  outcomeIndex?: number;
  quantity: number;
  price: number;
  totalValue: number;
  
  // Trade status
  status: TradeStatus;
  executedAt: Date;
  
  // PnL tracking
  realizedPnl?: number;
  unrealizedPnl?: number;
  
  // Copy trading metadata
  isCopyTrade: boolean;
  originalTradeId?: string;
  copiedByTraderId?: string;
  
  // Metadata
  sourceData?: Record<string, any>;
}

export interface LeaderboardData {
  source: MarketSource;
  traders: TraderData[];
  totalTraders: number;
  totalVolume: number;
  totalTrades: number;
  avgPnl: number;
  snapshotDate: Date;
}

export interface TraderFollowData {
  followerId: string;
  followingId: string;
  autoCopyTrades: boolean;
  maxCopyAmount?: number;
  copyPercentage?: number;
  totalCopiedTrades: number;
  totalCopiedValue: number;
  totalCopiedPnl: number;
}

// Source-specific interfaces
export interface DataSource {
  readonly name: MarketSource;
  readonly isActive: boolean;
  
  initialize(): Promise<void>;
  startPolling(): Promise<void>;
  stopPolling(): Promise<void>;
  getMarkets(): Promise<MarketData[]>;
  subscribeToUpdates(callback: (event: MarketEventData) => void): Promise<void>;
  unsubscribeFromUpdates(): Promise<void>;
}

export interface LeaderboardDataSource {
  readonly name: MarketSource;
  readonly isActive: boolean;
  
  initialize(): Promise<void>;
  startPolling(): Promise<void>;
  stopPolling(): Promise<void>;
  getLeaderboard(): Promise<LeaderboardData>;
  getTraderTrades(traderId: string, since?: Date): Promise<TradeData[]>;
  subscribeToTradeUpdates(callback: (trade: TradeData) => void): Promise<void>;
  unsubscribeFromTradeUpdates(): Promise<void>;
}

export interface SourceConfig {
  source: MarketSource;
  restEndpoint?: string;
  wsEndpoint?: string;
  graphqlEndpoint?: string;
  apiKey?: string;
  pollInterval?: number;
  rpcUrl?: string;
  contractAddress?: string;
  enabled: boolean;
}

// Normalization interfaces
export interface NormalizedMarket {
  sourceMarketId: string;
  source: MarketSource;
  marketData: MarketData;
  confidence: number; // 0-1 confidence in normalization
}

export interface NormalizedTrader {
  sourceTraderId: string;
  source: MarketSource;
  traderData: TraderData;
  confidence: number; // 0-1 confidence in normalization
}

export interface NormalizedTrade {
  sourceTradeId: string;
  source: MarketSource;
  tradeData: TradeData;
  confidence: number; // 0-1 confidence in normalization
}

export interface DeduplicationResult {
  canonicalMarketId: string;
  duplicateMarkets: string[];
  confidence: number;
}

// Configuration
export interface IndexerConfig {
  sources: SourceConfig[];
  database: {
    url: string;
  };
  polling: {
    defaultInterval: number;
    priceUpdateInterval: number;
    leaderboardInterval: number;
  };
  deduplication: {
    enabled: boolean;
    confidenceThreshold: number;
  };
  leaderboard: {
    enabled: boolean;
    syncInterval: number;
    maxTradersPerSource: number;
    copyTradingEnabled: boolean;
  };
  rateLimiting: {
    thegraph: {
      enabled: boolean;
      requestsPerMinute: number;
      requestsPerHour: number;
      burstLimit: number;
    };
    polymarket: {
      enabled: boolean;
      requestsPerMinute: number;
      requestsPerHour: number;
    };
  };
  logging: {
    level: string;
    file?: string;
  };
  queue: {
    batchSize: number;
    flushInterval: number;
    maxRetries: number;
    retryDelay: number;
  };
}

// Error types
export class IndexerError extends Error {
  constructor(
    message: string,
    public source: MarketSource,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'IndexerError';
  }
}

export class NormalizationError extends IndexerError {
  constructor(message: string, source: MarketSource, originalError?: Error) {
    super(message, source, originalError);
    this.name = 'NormalizationError';
  }
}

export class DataSourceError extends IndexerError {
  constructor(message: string, source: MarketSource, originalError?: Error) {
    super(message, source, originalError);
    this.name = 'DataSourceError';
  }
}

export class LeaderboardError extends IndexerError {
  constructor(message: string, source: MarketSource, originalError?: Error) {
    super(message, source, originalError);
    this.name = 'LeaderboardError';
  }
}
