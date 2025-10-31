export type MarketOutcome = {
  id: string;
  title: string;
  index: number;
  currentPrice: number;
  currentVolume?: number;
  currentLiquidity?: number;
  description?: string | null;
  isWinning?: boolean | null;
};

export type SourceMarket = {
  id: string;
  source: string;
  sourceMarketId: string;
  tokenId?: string;
  isActive: boolean;
};

export type Market = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  endDate: string;
  status: 'ACTIVE' | 'RESOLVED' | 'SUSPENDED' | string;
  totalVolume: number;
  totalLiquidity: number;
  participantCount: number;
  outcomes: MarketOutcome[];
  sourceMarkets: SourceMarket[];
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
};

export type Trader = {
  id: string;
  source: string;
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
};


