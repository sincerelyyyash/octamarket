use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ==================== User Models ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub user_id: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: String,
}

// ==================== Market Aggregation Models ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AggregatedMarketView {
    pub event_fingerprint: String,
    pub title: String,
    pub description: Option<String>,
    pub end_time: Option<String>,
    pub status: String,
    pub source_count: Option<i64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketSourceView {
    pub id: String,
    pub source: String,
    pub market_id: String,
    pub market_slug: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    pub outcomes: Option<serde_json::Value>,
    pub prices: Option<serde_json::Value>,
    pub traded_amount: Option<f64>,
    pub observed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BestPrice {
    pub event_fingerprint: String,
    pub event_title: String,
    pub best_yes_price: Option<f64>,
    pub best_yes_platform: Option<String>,
    pub best_yes_market_id: Option<String>,
    pub best_no_price: Option<f64>,
    pub best_no_platform: Option<String>,
    pub best_no_market_id: Option<String>,
    pub last_updated: DateTime<Utc>,
}

// ==================== Arbitrage Models ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ArbitrageAlert {
    pub id: String,
    pub event_fingerprint: String,
    pub event_title: String,
    pub opportunity_type: String,
    pub profit_pct: f64,
    pub profit_amount_usd: Option<f64>,
    pub buy_platform: String,
    pub buy_market_id: String,
    pub buy_outcome: String,
    pub buy_price: f64,
    pub sell_platform: String,
    pub sell_market_id: String,
    pub sell_outcome: String,
    pub sell_price: f64,
    pub min_capital_required: Option<f64>,
    pub detected_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageOpportunity {
    pub event_fingerprint: String,
    pub event_title: String,
    pub profit_pct: f64,
    pub buy_side: TradeSide,
    pub sell_side: TradeSide,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeSide {
    pub platform: String,
    pub market_id: String,
    pub outcome: String,
    pub price: f64,
}

// ==================== Order Models ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserOrder {
    pub id: String,
    pub user_id: String,
    pub platform: String,
    pub market_id: String,
    pub event_fingerprint: Option<String>,
    pub side: String,
    pub outcome: String,
    pub outcome_index: Option<i32>,
    pub price: f64,
    pub amount: f64,
    pub order_type: String,
    pub status: String,
    pub filled_amount: Option<f64>,
    pub avg_fill_price: Option<f64>,
    pub tx_hash: Option<String>,
    pub venue_order_id: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaceOrderRequest {
    pub market_id: String,
    pub platform: Option<String>, // If None, use best price
    pub side: String, // "buy" or "sell"
    pub outcome: String,
    pub price: f64,
    pub amount: f64,
    pub order_type: String, // "market" or "limit"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderResponse {
    pub order_id: String,
    pub status: String,
    pub message: Option<String>,
}

// ==================== Position Models ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserPosition {
    pub id: String,
    pub user_id: String,
    pub platform: String,
    pub market_id: String,
    pub event_fingerprint: Option<String>,
    pub outcome: String,
    pub outcome_index: Option<i32>,
    pub side: String,
    pub quantity: f64,
    pub avg_entry_price: f64,
    pub current_price: Option<f64>,
    pub unrealized_pnl: f64,
    pub realized_pnl: f64,
    pub total_cost: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ==================== Wallet Models ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserWallet {
    pub id: String,
    pub user_id: String,
    pub platform: String,
    pub wallet_address: String,
    pub is_primary: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectWalletRequest {
    pub platform: String,
    pub wallet_address: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WalletLeaderboardEntry {
    pub wallet_address: String,
    pub platform: String,
    pub nickname: Option<String>,
    pub total_trades: i32,
    pub win_count: i32,
    pub loss_count: i32,
    pub total_volume: f64,
    pub pnl_7d: f64,
    pub pnl_30d: f64,
    pub pnl_all_time: f64,
    pub win_rate: f64,
    pub avg_position_size: f64,
    pub last_trade_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WalletTradeView {
    pub platform: String,
    pub market_id: String,
    pub side: String,
    pub outcome_name: Option<String>,
    pub price: f64,
    pub amount: f64,
    pub tx_hash: Option<String>,
    pub timestamp: String,
}

// ==================== Leader Models ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LeaderWithStats {
    pub leader_id: String,
    pub wallet_address: String,
    pub platform: String,
    pub name: String,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub is_verified: bool,
    pub followers_count: i32,
    pub pnl_7d: f64,
    pub pnl_30d: f64,
    pub win_rate: f64,
    pub total_trades: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderDetail {
    pub leader_id: String,
    pub wallet_address: String,
    pub platform: String,
    pub name: String,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub is_verified: bool,
    pub followers_count: i32,
    pub stats: LeaderStats,
    pub markets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderStats {
    pub pnl_7d: f64,
    pub pnl_30d: f64,
    pub pnl_all_time: f64,
    pub win_rate: f64,
    pub total_trades: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackLeaderRequest {
    pub wallet_address: String,
    pub platform: String,
    pub nickname: Option<String>,
}

// ==================== Helper Models ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessResponse {
    pub success: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: Some(1),
            limit: Some(50),
        }
    }
}


