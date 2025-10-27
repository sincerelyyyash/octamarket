use crate::errors::ApiError;
use crate::models::*;
use sqlx::{PgPool, postgres::PgPoolOptions};
use uuid::Uuid;

/// Database struct with connections to both octamarket and indexer databases
#[derive(Clone)]
pub struct DualDatabase {
    /// Trading database (octamarket) - read/write
    trading_pool: PgPool,
    /// Indexer database - read-only for market data
    indexer_pool: PgPool,
}

impl DualDatabase {
    pub async fn new(trading_url: &str, indexer_url: &str) -> Result<Self, sqlx::Error> {
        let trading_pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(trading_url)
            .await?;

        let indexer_pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(indexer_url)
            .await?;

        Ok(Self {
            trading_pool,
            indexer_pool,
        })
    }

    pub fn trading_pool(&self) -> &PgPool {
        &self.trading_pool
    }

    pub fn indexer_pool(&self) -> &PgPool {
        &self.indexer_pool
    }

    // ---------- User Operations (Trading DB)

    pub async fn create_user(
        &self,
        email: &str,
        password_hash: &str,
    ) -> Result<String, ApiError> {
        let user_id = format!("usr_{}", Uuid::new_v4().simple());

        sqlx::query(
            "INSERT INTO users (user_id, email, password_hash) VALUES ($1, $2, $3)",
        )
        .bind(&user_id)
        .bind(email)
        .bind(password_hash)
        .execute(&self.trading_pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    return ApiError::Validation("Email already exists".to_string());
                }
            }
            ApiError::Database(e)
        })?;

        Ok(user_id)
    }

    pub async fn get_user_by_email(&self, email: &str) -> Result<Option<User>, ApiError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT user_id, email, password_hash, created_at FROM users WHERE email = $1",
        )
        .bind(email)
        .fetch_optional(&self.trading_pool)
        .await?;

        Ok(user)
    }

    // ---------- Market Data Operations (Indexer DB - Read Only)

    /// Get aggregated markets from indexer DB
    pub async fn get_aggregated_markets(&self, limit: Option<i64>) -> Result<Vec<AggregatedMarketView>, ApiError> {
        let limit_val = limit.unwrap_or(100);
        
        let markets = sqlx::query_as::<_, AggregatedMarketView>(
            r#"
            SELECT 
                ae.event_fingerprint,
                ae.title,
                ae.description,
                ae.end_time,
                ae.status,
                COUNT(DISTINCT ms.id) as source_count,
                ae.created_at
            FROM aggregated_events ae
            LEFT JOIN market_sources ms ON ae.id = ms.aggregated_event_id
            WHERE ae.status = 'active'
            GROUP BY ae.event_fingerprint, ae.title, ae.description, ae.end_time, ae.status, ae.created_at
            ORDER BY ae.created_at DESC
            LIMIT $1
            "#
        )
        .bind(limit_val)
        .fetch_all(&self.indexer_pool)
        .await?;

        Ok(markets)
    }

    /// Get market sources for a specific event from indexer DB
    pub async fn get_market_sources_for_event(&self, event_fingerprint: &str) -> Result<Vec<MarketSourceView>, ApiError> {
        let sources = sqlx::query_as::<_, MarketSourceView>(
            r#"
            SELECT 
                ms.id,
                ms.source,
                ms.market_id,
                ms.market_slug,
                ms.name,
                ms.status,
                ms.outcomes,
                ms.prices,
                ms.traded_amount,
                ms.observed_at
            FROM market_sources ms
            JOIN aggregated_events ae ON ms.aggregated_event_id = ae.id
            WHERE ae.event_fingerprint = $1
            ORDER BY ms.observed_at DESC
            "#
        )
        .bind(event_fingerprint)
        .fetch_all(&self.indexer_pool)
        .await?;

        Ok(sources)
    }

    /// Get wallet leaderboard from indexer DB
    pub async fn get_wallet_leaderboard(&self, limit: Option<i64>) -> Result<Vec<WalletLeaderboardEntry>, ApiError> {
        let limit_val = limit.unwrap_or(50);
        
        let entries = sqlx::query_as::<_, WalletLeaderboardEntry>(
            r#"
            SELECT 
                tw.wallet_address,
                tw.platform,
                tw.nickname,
                ws.total_trades,
                ws.win_count,
                ws.loss_count,
                ws.total_volume,
                ws.pnl_7d,
                ws.pnl_30d,
                ws.pnl_all_time,
                ws.win_rate,
                ws.avg_position_size,
                ws.last_trade_at
            FROM tracked_wallets tw
            JOIN wallet_stats ws ON tw.id = ws.wallet_id
            WHERE tw.is_active = true
            ORDER BY ws.pnl_30d DESC
            LIMIT $1
            "#
        )
        .bind(limit_val)
        .fetch_all(&self.indexer_pool)
        .await?;

        Ok(entries)
    }

    /// Get wallet trades from indexer DB
    pub async fn get_wallet_trades(&self, wallet_address: &str, limit: Option<i64>) -> Result<Vec<WalletTradeView>, ApiError> {
        let limit_val = limit.unwrap_or(100);
        
        let trades = sqlx::query_as::<_, WalletTradeView>(
            r#"
            SELECT 
                wt.platform,
                wt.market_id,
                wt.side,
                wt.outcome_name,
                wt.price,
                wt.amount,
                wt.tx_hash,
                wt.timestamp
            FROM wallet_trades wt
            JOIN tracked_wallets tw ON wt.wallet_id = tw.id
            WHERE tw.wallet_address = $1
            ORDER BY wt.timestamp DESC
            LIMIT $2
            "#
        )
        .bind(wallet_address)
        .bind(limit_val)
        .fetch_all(&self.indexer_pool)
        .await?;

        Ok(trades)
    }

    // ---------- Leader Operations (Trading DB)

    pub async fn get_leaders(&self) -> Result<Vec<LeaderWithStats>, ApiError> {
        let leaders = sqlx::query_as::<_, LeaderWithStats>(
            r#"
            SELECT 
                l.leader_id,
                l.wallet_address,
                l.platform,
                l.name,
                l.bio,
                l.avatar_url,
                l.is_verified,
                l.followers_count,
                ls.pnl_7d,
                ls.pnl_30d,
                ls.win_rate,
                ls.total_trades
            FROM leaders l
            LEFT JOIN leader_stats ls ON l.leader_id = ls.leader_id
            WHERE l.is_active = true
            ORDER BY ls.pnl_30d DESC NULLS LAST
            "#
        )
        .fetch_all(&self.trading_pool)
        .await?;

        Ok(leaders)
    }

    pub async fn get_leader(&self, leader_id: &str) -> Result<LeaderDetail, ApiError> {
        #[derive(sqlx::FromRow)]
        struct LeaderDetailRow {
            leader_id: String,
            wallet_address: String,
            platform: String,
            name: String,
            bio: Option<String>,
            avatar_url: Option<String>,
            is_verified: bool,
            followers_count: i32,
            pnl_7d: f64,
            pnl_30d: f64,
            pnl_all_time: f64,
            win_rate: f64,
            total_trades: i32,
            markets: Vec<String>,
        }

        let row = sqlx::query_as::<_, LeaderDetailRow>(
            r#"
            SELECT 
                l.leader_id, l.wallet_address, l.platform, l.name, l.bio, l.avatar_url,
                l.is_verified, l.followers_count,
                COALESCE(ls.pnl_7d, 0) as pnl_7d,
                COALESCE(ls.pnl_30d, 0) as pnl_30d,
                COALESCE(ls.pnl_all_time, 0) as pnl_all_time,
                COALESCE(ls.win_rate, 0) as win_rate,
                COALESCE(ls.total_trades, 0) as total_trades,
                COALESCE(array_agg(lm.market_id) FILTER (WHERE lm.market_id IS NOT NULL), '{}') as markets
            FROM leaders l
            LEFT JOIN leader_stats ls ON l.leader_id = ls.leader_id
            LEFT JOIN leader_markets lm ON l.leader_id = lm.leader_id
            WHERE l.leader_id = $1
            GROUP BY l.leader_id, l.wallet_address, l.platform, l.name, l.bio, l.avatar_url,
                     l.is_verified, l.followers_count, ls.pnl_7d, ls.pnl_30d, ls.pnl_all_time, 
                     ls.win_rate, ls.total_trades
            "#
        )
        .bind(leader_id)
        .fetch_optional(&self.trading_pool)
        .await?
        .ok_or(ApiError::NotFound)?;

        Ok(LeaderDetail {
            leader_id: row.leader_id,
            wallet_address: row.wallet_address,
            platform: row.platform,
            name: row.name,
            bio: row.bio,
            avatar_url: row.avatar_url,
            is_verified: row.is_verified,
            followers_count: row.followers_count,
            stats: LeaderStats {
                pnl_7d: row.pnl_7d,
                pnl_30d: row.pnl_30d,
                pnl_all_time: row.pnl_all_time,
                win_rate: row.win_rate,
                total_trades: row.total_trades,
            },
            markets: row.markets,
        })
    }

    // Additional trading DB methods would go here...
    // (follows, orders, positions, etc. - similar to existing db.rs)
}


