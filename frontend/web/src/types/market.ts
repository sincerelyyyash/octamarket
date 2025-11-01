export enum MarketStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED',
}

export enum MarketSource {
  POLYMARKET = 'POLYMARKET',
  KALSHI = 'KALSHI',
  AUGUR = 'AUGUR',
  THALES = 'THALES',
  OMEN = 'OMEN',
}

export interface OutcomePrice {
  source: MarketSource;
  price: number;
  volume?: number;
  liquidity?: number;
  timestamp: string;
}

export interface MarketOutcome {
  id: string;
  title: string;
  description?: string;
  index: number;
  currentPrice?: number; // Best price (deprecated, use bestPrice)
  currentVolume?: number;
  currentLiquidity?: number;
  isWinning?: boolean;
  prices?: OutcomePrice[]; // Per-source prices
  bestPrice?: number; // Best price across sources
  bestPriceSource?: MarketSource; // Source with best price
}

export interface SourceMarket {
  id: string;
  source: MarketSource;
  sourceMarketId: string;
  tokenId?: string;
  conditionId?: string;
  isActive: boolean;
}

export interface Market {
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
  outcomes: MarketOutcome[];
  sourceMarkets: SourceMarket[];
}

export interface MarketFilters {
  status?: MarketStatus;
  category?: string;
  source?: MarketSource;
  tags?: string;
  search?: string;
}

export interface PriceHistoryPoint {
  id: string;
  marketId: string;
  outcomeId: string;
  source: MarketSource;
  price: number;
  volume: number;
  liquidity: number;
  timestamp: string;
}

