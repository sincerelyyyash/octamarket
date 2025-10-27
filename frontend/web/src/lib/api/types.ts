// ==================== Market Types ====================

export interface AggregatedMarket {
  event_fingerprint: string;
  title: string;
  description?: string;
  end_time?: string;
  status: string;
  source_count?: number;
  created_at: string;
}

export interface MarketSource {
  id: string;
  source: string;
  market_id: string;
  market_slug?: string;
  name?: string;
  status?: string;
  outcomes?: any;
  prices?: any;
  traded_amount?: number;
  observed_at: string;
}

export interface BestPrice {
  event_fingerprint: string;
  event_title: string;
  best_yes_price?: number;
  best_yes_platform?: string;
  best_yes_market_id?: string;
  best_no_price?: number;
  best_no_platform?: string;
  best_no_market_id?: string;
  last_updated: string;
}

// ==================== Arbitrage Types ====================

export interface ArbitrageAlert {
  id: string;
  event_fingerprint: string;
  event_title: string;
  opportunity_type: string;
  profit_pct: number;
  profit_amount_usd?: number;
  buy_platform: string;
  buy_market_id: string;
  buy_outcome: string;
  buy_price: number;
  sell_platform: string;
  sell_market_id: string;
  sell_outcome: string;
  sell_price: number;
  min_capital_required?: number;
  detected_at: string;
  expires_at?: string;
  status: string;
}

// ==================== Order Types ====================

export interface Order {
  id: string;
  user_id: string;
  platform: string;
  market_id: string;
  event_fingerprint?: string;
  side: string;
  outcome: string;
  outcome_index?: number;
  price: number;
  amount: number;
  order_type: string;
  status: string;
  filled_amount?: number;
  avg_fill_price?: number;
  tx_hash?: string;
  venue_order_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface PlaceOrderRequest {
  market_id: string;
  platform?: string;
  side: string;
  outcome: string;
  price: number;
  amount: number;
  order_type: string;
}

export interface OrderResponse {
  order_id: string;
  status: string;
  message?: string;
}

// ==================== Wallet Types ====================

export interface UserWallet {
  id: string;
  user_id: string;
  platform: string;
  wallet_address: string;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface ConnectWalletRequest {
  platform: string;
  wallet_address: string;
  signature: string;
}

export interface WalletLeaderboardEntry {
  wallet_address: string;
  platform: string;
  nickname?: string;
  total_trades: number;
  win_count: number;
  loss_count: number;
  total_volume: number;
  pnl_7d: number;
  pnl_30d: number;
  pnl_all_time: number;
  win_rate: number;
  avg_position_size: number;
  last_trade_at?: string;
}

export interface WalletTrade {
  platform: string;
  market_id: string;
  side: string;
  outcome_name?: string;
  price: number;
  amount: number;
  tx_hash?: string;
  timestamp: string;
}

// ==================== Leader Types ====================

export interface Leader {
  leader_id: string;
  wallet_address: string;
  platform: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  is_verified: boolean;
  followers_count: number;
  pnl_7d: number;
  pnl_30d: number;
  win_rate: number;
  total_trades: number;
}

export interface LeaderDetail extends Leader {
  stats: {
    pnl_7d: number;
    pnl_30d: number;
    pnl_all_time: number;
    win_rate: number;
    total_trades: number;
  };
  markets: string[];
}

// ==================== Auth Types ====================

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user_id: string;
}

// ==================== Pagination ====================

export interface PaginationParams {
  page?: number;
  limit?: number;
}


