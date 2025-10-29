import { MarketSource, MarketStatus } from '@repo/database';

// Request/Response types
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface MarketFilters {
  status?: MarketStatus;
  category?: string;
  source?: MarketSource;
  tags?: string[];
  search?: string;
  sortBy?: 'volume' | 'liquidity' | 'endDate' | 'createdAt' | 'participantCount';
  sortOrder?: 'asc' | 'desc';
}

export interface TraderFilters {
  source?: MarketSource;
  allowCopyTrading?: boolean;
  isPublic?: boolean;
  search?: string;
  sortBy?: 'totalPnl' | 'totalVolume' | 'winRate' | 'totalTrades' | 'currentRank';
  sortOrder?: 'asc' | 'desc';
}

export interface LeaderboardFilters {
  source?: MarketSource;
  timeframe?: 'day' | 'week' | 'month' | 'all';
  sortBy?: 'totalPnl' | 'totalVolume' | 'winRate';
  sortOrder?: 'asc' | 'desc';
}

export interface CopyTradingSettings {
  autoCopyTrades: boolean;
  maxCopyAmount?: number;
  copyPercentage?: number;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends AuthRequest {
  name: string;
}

export interface LoginRequest extends AuthRequest {}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface FollowTraderRequest {
  traderId: string;
  settings?: CopyTradingSettings;
}

export interface UpdateFollowSettingsRequest extends CopyTradingSettings {}

// Database entity types (simplified for API responses)
export interface MarketResponse {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  endDate?: string;
  resolutionDate?: string;
  status: MarketStatus;
  totalVolume?: number;
  totalLiquidity?: number;
  participantCount?: number;
  resolvedOutcome?: string;
  resolutionSource?: string;
  outcomes: MarketOutcomeResponse[];
  sourceMarkets: SourceMarketResponse[];
}

export interface MarketOutcomeResponse {
  id: string;
  title: string;
  description?: string;
  index: number;
  currentPrice?: number;
  currentVolume?: number;
  currentLiquidity?: number;
  isWinning?: boolean;
}

export interface SourceMarketResponse {
  id: string;
  source: MarketSource;
  sourceMarketId: string;
  isActive: boolean;
}

export interface TraderResponse {
  id: string;
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
  rankChange?: number;
  lastActiveAt?: string;
  firstTradeAt?: string;
  lastTradeAt?: string;
  isPublic: boolean;
  allowCopyTrading: boolean;
  maxFollowers?: number;
}

export interface TradeResponse {
  id: string;
  traderId: string;
  source: MarketSource;
  sourceTradeId: string;
  marketId?: string;
  sourceMarketId: string;
  side: 'BUY' | 'SELL';
  outcomeIndex?: number;
  quantity: number;
  price: number;
  totalValue: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
  executedAt: string;
  realizedPnl?: number;
  unrealizedPnl?: number;
  isCopyTrade: boolean;
  originalTradeId?: string;
  copiedByTraderId?: string;
}

export interface LeaderboardResponse {
  source: MarketSource;
  traders: TraderResponse[];
  totalTraders: number;
  totalVolume: number;
  totalTrades: number;
  avgPnl: number;
  snapshotDate: string;
}

export interface TraderFollowResponse {
  id: string;
  followerId: string;
  followingId: string;
  autoCopyTrades: boolean;
  maxCopyAmount?: number;
  copyPercentage?: number;
  totalCopiedTrades: number;
  totalCopiedValue: number;
  totalCopiedPnl: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistoryResponse {
  id: string;
  marketId: string;
  outcomeId?: string;
  source: MarketSource;
  price: number;
  volume?: number;
  liquidity?: number;
  timestamp: string;
}

export interface PlatformStatsResponse {
  totalMarkets: number;
  activeMarkets: number;
  totalTraders: number;
  totalVolume: number;
  totalTrades: number;
  avgPnl: number;
}

export interface MarketStatsResponse {
  byCategory: Record<string, number>;
  bySource: Record<MarketSource, number>;
  byStatus: Record<MarketStatus, number>;
  topPerforming: MarketResponse[];
}

export interface SourceStatsResponse {
  source: MarketSource;
  totalMarkets: number;
  totalTraders: number;
  totalVolume: number;
  totalTrades: number;
  avgPnl: number;
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Express Request extensions
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
      };
    }
  }
}
