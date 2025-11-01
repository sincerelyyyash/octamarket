/**
 * Common types for collectors
 */

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  description?: string;
  endDate?: string;
  startDate?: string;
  image?: string;
  icon?: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  outcomes: string[];
  outcomePrices?: string[];
  volume?: string;
  liquidity?: string;
  volumeNum?: number;
  liquidityNum?: number;
  clobTokenIds?: string;
  tags?: string[];
  [key: string]: any;
}

export interface PolymarketLeaderboardEntry {
  rank: string | number;
  proxyWallet: string;
  userName?: string;
  xUsername?: string;
  vol: number;
  pnl: number;
  profileImage?: string;
}

export interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  market_type?: string;
  title: string;
  subtitle?: string;
  open_time?: string;
  close_time?: string;
  expiration_time?: string;
  status?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  open_interest?: number;
  [key: string]: any;
}

export interface PaginationResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
  totalResults?: number;
}

export interface CollectorOptions {
  batchSize?: number;
  maxRetries?: number;
}

