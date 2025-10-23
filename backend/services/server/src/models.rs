use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

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
    pub markets: Vec<String>,
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
    pub market_id: String,
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
    pub market_id: String,
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
    pub market_id: String,
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
    pub market_id: String,
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

// ---------- Helper functions

impl FollowCreate {
    pub fn validate(&self) -> Result<(), String> {
        if !(0.0..=1.0).contains(&self.max_utilization_pct) {
            return Err("maxUtilizationPct must be within [0,1]".into());
        }
        if !(0.0..=1.0).contains(&self.max_per_trade_pct) {
            return Err("maxPerTradePct must be within [0,1]".into());
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
        Ok(())
    }
}

