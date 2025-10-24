use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ---------- Auth Models

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub user_id: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

// ---------- Market Data Models (from Indexer)

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AggregatedEvent {
    pub id: Uuid,
    pub event_fingerprint: String,
    pub title: String,
    pub description: Option<String>,
    pub end_time: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketSource {
    pub id: Uuid,
    pub aggregated_event_id: Uuid,
    pub source: String,
    pub market_id: String,
    pub market_slug: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    pub outcomes: Option<serde_json::Value>,
    pub prices: Option<serde_json::Value>,
    pub traded_amount: Option<f64>,
    pub resolved_outcome: Option<String>,
    pub observed_at: DateTime<Utc>,
    pub raw_payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PriceHistoryEntry {
    pub id: Uuid,
    pub market_source_id: Uuid,
    pub outcome_index: i32,
    pub outcome_name: String,
    pub price: f64,
    pub volume: Option<f64>,
    pub timestamp: DateTime<Utc>,
    pub source_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketData {
    pub event_fingerprint: String,
    pub event_title: String,
    pub description: Option<String>,
    pub end_time: Option<DateTime<Utc>>,
    pub event_status: String,
    pub source: String,
    pub market_id: String,
    pub market_name: Option<String>,
    pub market_status: Option<String>,
    pub outcomes: Option<serde_json::Value>,
    pub prices: Option<serde_json::Value>,
    pub traded_amount: Option<f64>,
    pub observed_at: DateTime<Utc>,
    pub market_created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PriceTrend {
    pub market_id: String,
    pub source: String,
    pub outcome_name: String,
    pub price: f64,
    pub volume: Option<f64>,
    pub timestamp: DateTime<Utc>,
    pub event_title: String,
}

// ---------- Leader Models

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Leader {
    pub leader_id: String,
    pub name: String,
    pub pnl7d: f64,
    pub followers: i32,
    pub is_live: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderDetail {
    pub leader_id: String,
    pub name: String,
    pub stats: Stats,
    pub markets: Vec<MarketSource>, // Now includes full market data
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Stats {
    pub pnl7d: f64,
    pub pnl30d: f64,
    pub win_rate: f64,
}

// ---------- Follow Models

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowCreate {
    pub leader_id: String,
    pub base_allocation_usdc: f64,
    pub max_utilization_pct: f64,
    pub max_per_trade_pct: f64,
    pub slippage_bps: i32,
    pub auto_close_with_leader: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FollowUpdate {
    #[serde(default)]
    pub max_utilization_pct: Option<f64>,
    #[serde(default)]
    pub max_per_trade_pct: Option<f64>,
    #[serde(default)]
    pub slippage_bps: Option<i32>,
    #[serde(default)]
    pub auto_close_with_leader: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Follow {
    pub follow_id: String,
    pub user_id: String,
    pub leader_id: String,
    pub base_allocation_usdc: f64,
    pub max_utilization_pct: f64,
    pub max_per_trade_pct: f64,
    pub slippage_bps: i32,
    pub auto_close_with_leader: bool,
    pub status: String,
    pub utilized_usdc: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowView {
    pub follow_id: String,
    pub leader_id: String,
    pub base_allocation_usdc: f64,
    pub utilization_now_pct: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Unfollow {
    pub leader_id: String,
    pub action: String, // "pause" | "stop"
}

// ---------- Trade Event Models

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderTradeEvent {
    pub idempotency_key: String,
    pub leader_id: String,
    pub venue: String,
    pub market_source_id: Uuid, // Now references market_sources
    pub side: String, // "buy" | "sell"
    pub price: Option<f64>,
    pub notional_usdc: f64,
    pub ts: String,
}

// ---------- Job Models

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ReplicationJob {
    pub job_id: String,
    pub follow_id: String,
    pub user_id: String,
    pub leader_id: String,
    pub venue: String,
    pub market_source_id: Uuid, // Now references market_sources
    pub side: String,
    pub size_usdc: f64,
    pub slippage_bps: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicationComplete {
    pub status: String, // "filled" | "partial" | "skipped" | "failed"
    pub filled_usdc: Option<f64>,
    pub avg_price: Option<f64>,
    pub venue_order_id: Option<String>,
    pub tx_hash: Option<String>,
    pub reason: Option<String>,
}

// ---------- Position Models

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Position {
    pub market_source_id: Uuid, // Now references market_sources
    pub side: String,
    pub size_usdc: f64,
    pub avg_price: f64,
    pub unrealized: f64,
}

// ---------- Order Models

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Order {
    pub id: String,
    pub user_id: String,
    pub leader_id: String,
    pub market_source_id: Uuid, // Now references market_sources
    pub side: String,
    pub size_usdc: f64,
    pub status: String,
    pub filled_usdc: Option<f64>,
    pub avg_price: Option<f64>,
    pub created_at: DateTime<Utc>,
}

// ---------- Request/Response Models

#[derive(Deserialize)]
pub struct FollowsMeQuery {
    #[allow(dead_code)]
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct JobsQuery {
    #[allow(dead_code)]
    pub status: Option<String>, // "pending"
}

#[derive(Deserialize)]
pub struct CloseAllReq {
    #[allow(dead_code)]
    pub mode: String,
    #[allow(dead_code)]
    pub slippage_bps: i32,
}

// ---------- Market Data Query Models

#[derive(Deserialize)]
pub struct EventsQuery {
    pub limit: Option<usize>,
    pub status: Option<String>,
    #[allow(dead_code)]
    pub source: Option<String>,
}

#[derive(Deserialize)]
pub struct MarketsQuery {
    pub event_fingerprint: Option<String>,
    pub source: Option<String>,
    pub status: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct PriceHistoryQuery {
    pub market_source_id: Uuid,
    pub limit: Option<usize>,
    pub hours_back: Option<i64>,
}

// ---------- Helper functions

impl FollowCreate {
    pub fn validate(&self) -> Result<(), String> {
        if self.base_allocation_usdc <= 0.0 {
            return Err("base_allocation_usdc must be positive".to_string());
        }
        if self.base_allocation_usdc > 1_000_000.0 {
            return Err("base_allocation_usdc too large (max 1,000,000)".to_string());
        }
        if !(0.0..=1.0).contains(&self.max_utilization_pct) {
            return Err("maxUtilizationPct must be within [0,1]".into());
        }
        if !(0.0..=1.0).contains(&self.max_per_trade_pct) {
            return Err("maxPerTradePct must be within [0,1]".into());
        }
        if self.slippage_bps < 0 || self.slippage_bps > 10000 {
            return Err("slippage_bps must be between 0 and 10000".to_string());
        }
        if self.leader_id.is_empty() || self.leader_id.len() > 50 {
            return Err("leader_id must be 1-50 characters".to_string());
        }
        Ok(())
    }
}

impl FollowUpdate {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(v) = self.max_utilization_pct {
            if !(0.0..=1.0).contains(&v) {
                return Err("maxUtilizationPct must be within [0,1]".into());
            }
        }
        if let Some(v) = self.max_per_trade_pct {
            if !(0.0..=1.0).contains(&v) {
                return Err("maxPerTradePct must be within [0,1]".into());
            }
        }
        if let Some(v) = self.slippage_bps {
            if v < 0 || v > 10000 {
                return Err("slippage_bps must be between 0 and 10000".to_string());
            }
        }
        Ok(())
    }
}

impl LeaderTradeEvent {
    pub fn validate(&self) -> Result<(), String> {
        if self.notional_usdc <= 0.0 {
            return Err("notionalUsdc must be positive".to_string());
        }
        if self.notional_usdc > 1_000_000.0 {
            return Err("notionalUsdc too large (max 1,000,000)".to_string());
        }
        if !matches!(self.side.as_str(), "buy" | "sell") {
            return Err("side must be 'buy' or 'sell'".to_string());
        }
        if self.leader_id.is_empty() || self.leader_id.len() > 50 {
            return Err("leader_id must be 1-50 characters".to_string());
        }
        if self.venue.is_empty() || self.venue.len() > 50 {
            return Err("venue must be 1-50 characters".to_string());
        }
        if self.idempotency_key.is_empty() || self.idempotency_key.len() > 255 {
            return Err("idempotency_key must be 1-255 characters".to_string());
        }
        if let Some(price) = self.price {
            if price <= 0.0 || price > 1.0 {
                return Err("price must be between 0 and 1".to_string());
            }
        }
        Ok(())
    }
}

