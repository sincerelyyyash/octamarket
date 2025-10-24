use crate::errors::ApiError;
use crate::models::*;
use sqlx::{PgPool, postgres::PgPoolOptions};
use uuid::Uuid;
use std::time::Duration;

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .idle_timeout(std::time::Duration::from_secs(600))
            .max_lifetime(std::time::Duration::from_secs(1800))
            .connect(database_url)
            .await?;

        // Test the connection
        sqlx::query("SELECT 1")
            .fetch_one(&pool)
            .await?;

        Ok(Self { pool })
    }

    #[allow(dead_code)]
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    // Helper function to execute database operations with retry logic
    async fn execute_with_retry<F, Fut, T>(&self, operation: F) -> Result<T, ApiError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, sqlx::Error>>,
    {
        let mut attempts = 0;
        let max_attempts = 3;
        
        loop {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    attempts += 1;
                    if attempts >= max_attempts {
                        tracing::error!("Database operation failed after {} attempts: {}", max_attempts, e);
                        return Err(ApiError::Database(e));
                    }
                    
                    // Check if it's a connection error that might be retryable
                    if matches!(e, sqlx::Error::PoolTimedOut | sqlx::Error::Database(_)) {
                        tracing::warn!("Database connection error (attempt {}): {}, retrying...", attempts, e);
                        tokio::time::sleep(Duration::from_millis(100 * attempts as u64)).await;
                        continue;
                    }
                    
                    // For non-connection errors, don't retry
                    return Err(ApiError::Database(e));
                }
            }
        }
    }

    // Helper function to log database operations for monitoring
    async fn log_operation<F, Fut, T>(&self, operation_name: &str, operation: F) -> Result<T, ApiError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, sqlx::Error>>,
    {
        let start = std::time::Instant::now();
        let result = self.execute_with_retry(operation).await;
        let duration = start.elapsed();
        
        match &result {
            Ok(_) => {
                tracing::debug!("Database operation '{}' completed in {:?}", operation_name, duration);
            }
            Err(e) => {
                tracing::error!("Database operation '{}' failed after {:?}: {}", operation_name, duration, e);
            }
        }
        
        result
    }

    // ---------- User Operations

    pub async fn create_user(
        &self,
        email: &str,
        password_hash: &str,
    ) -> Result<String, ApiError> {
        let user_id = format!("usr_{}", Uuid::new_v4().simple());

        let result = self.execute_with_retry(|| async {
            sqlx::query(
                "INSERT INTO users (user_id, email, password_hash) VALUES ($1, $2, $3)",
            )
            .bind(&user_id)
            .bind(email)
            .bind(password_hash)
            .execute(&self.pool)
            .await
        }).await;

        match result {
            Ok(_) => Ok(user_id),
            Err(ApiError::Database(sqlx::Error::Database(db_err))) => {
                if db_err.is_unique_violation() {
                    Err(ApiError::Validation("Email already exists".to_string()))
                } else {
                    Err(ApiError::Database(sqlx::Error::Database(db_err)))
                }
            }
            Err(e) => Err(e),
        }
    }

    pub async fn get_user_by_email(&self, email: &str) -> Result<Option<User>, ApiError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT user_id, email, password_hash, created_at FROM users WHERE email = $1",
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    #[allow(dead_code)]
    pub async fn get_user_by_id(&self, user_id: &str) -> Result<Option<User>, ApiError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT user_id, email, password_hash, created_at FROM users WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    // ---------- Market Data Operations

    pub async fn get_events(&self, query: &EventsQuery) -> Result<Vec<AggregatedEvent>, ApiError> {
        let mut sql = "SELECT id, event_fingerprint, title, description, end_time, status, created_at, updated_at FROM aggregated_events".to_string();
        let mut conditions = Vec::new();

        if let Some(_status) = &query.status {
            conditions.push("status = $1".to_string());
        }

        if !conditions.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&conditions.join(" AND "));
        }

        sql.push_str(" ORDER BY created_at DESC");

        if let Some(limit) = query.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        let mut query_builder = sqlx::query_as::<_, AggregatedEvent>(&sql);
        
        if let Some(status) = &query.status {
            query_builder = query_builder.bind(status);
        }

        let events = query_builder
            .fetch_all(&self.pool)
            .await?;

        Ok(events)
    }

    pub async fn get_event(&self, event_fingerprint: &str) -> Result<AggregatedEvent, ApiError> {
        let event = sqlx::query_as::<_, AggregatedEvent>(
            "SELECT id, event_fingerprint, title, description, end_time, status, created_at, updated_at FROM aggregated_events WHERE event_fingerprint = $1"
        )
        .bind(event_fingerprint)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ApiError::NotFound)?;

        Ok(event)
    }

    pub async fn get_markets(&self, query: &MarketsQuery) -> Result<Vec<MarketData>, ApiError> {
        let mut sql = r#"
            SELECT 
                ae.event_fingerprint,
                ae.title as event_title,
                ae.description,
                ae.end_time,
                ae.status as event_status,
                ms.source,
                ms.market_id,
                ms.name as market_name,
                ms.status as market_status,
                ms.outcomes,
                ms.prices,
                ms.traded_amount,
                ms.observed_at,
                ms.created_at as market_created_at
            FROM aggregated_events ae
            JOIN market_sources ms ON ae.id = ms.aggregated_event_id
        "#.to_string();

        let mut conditions = Vec::new();

        if let Some(_event_fingerprint) = &query.event_fingerprint {
            conditions.push("ae.event_fingerprint = $1".to_string());
        }

        if let Some(_source) = &query.source {
            conditions.push("ms.source = $2".to_string());
        }

        if let Some(_status) = &query.status {
            conditions.push("ms.status = $3".to_string());
        }

        if !conditions.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&conditions.join(" AND "));
        }

        sql.push_str(" ORDER BY ms.observed_at DESC");

        if let Some(limit) = query.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        let mut query_builder = sqlx::query_as::<_, MarketData>(&sql);
        
        if let Some(event_fingerprint) = &query.event_fingerprint {
            query_builder = query_builder.bind(event_fingerprint);
        }
        if let Some(source) = &query.source {
            query_builder = query_builder.bind(source);
        }
        if let Some(status) = &query.status {
            query_builder = query_builder.bind(status);
        }

        let markets = query_builder
            .fetch_all(&self.pool)
            .await?;

        Ok(markets)
    }

    pub async fn get_market_source(&self, market_source_id: &Uuid) -> Result<MarketSource, ApiError> {
        let market = sqlx::query_as::<_, MarketSource>(
            "SELECT id, aggregated_event_id, source, market_id, market_slug, name, status, outcomes, prices, traded_amount, resolved_outcome, observed_at, raw_payload, created_at FROM market_sources WHERE id = $1"
        )
        .bind(market_source_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ApiError::NotFound)?;

        Ok(market)
    }

    pub async fn validate_market_source_exists(&self, market_source_id: &Uuid) -> Result<bool, ApiError> {
        let exists: (bool,) = sqlx::query_as(
            "SELECT EXISTS(SELECT 1 FROM market_sources WHERE id = $1)"
        )
        .bind(market_source_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(exists.0)
    }

    pub async fn get_price_history(&self, query: &PriceHistoryQuery) -> Result<Vec<PriceHistoryEntry>, ApiError> {
        let mut sql = r#"
            SELECT id, market_source_id, outcome_index, outcome_name, price, volume, timestamp, source_data
            FROM price_history
            WHERE market_source_id = $1
        "#.to_string();

        if let Some(hours_back) = query.hours_back {
            sql.push_str(&format!(" AND timestamp >= NOW() - INTERVAL '{} hours'", hours_back));
        }

        sql.push_str(" ORDER BY timestamp DESC");

        if let Some(limit) = query.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        let history = sqlx::query_as::<_, PriceHistoryEntry>(&sql)
            .bind(query.market_source_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(history)
    }

    pub async fn get_price_trends(&self, market_source_id: &Uuid) -> Result<Vec<PriceTrend>, ApiError> {
        let trends = sqlx::query_as::<_, PriceTrend>(
            r#"
            SELECT 
                ms.market_id,
                ms.source,
                ph.outcome_name,
                ph.price,
                ph.volume,
                ph.timestamp,
                ae.title as event_title
            FROM price_history ph
            JOIN market_sources ms ON ph.market_source_id = ms.id
            JOIN aggregated_events ae ON ms.aggregated_event_id = ae.id
            WHERE ph.market_source_id = $1
            ORDER BY ph.timestamp DESC
            "#
        )
        .bind(market_source_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(trends)
    }

    // ---------- Leader Operations

    pub async fn get_leaders(&self) -> Result<Vec<Leader>, ApiError> {
        let leaders = sqlx::query_as::<_, Leader>(
            "SELECT leader_id, name, pnl7d, followers, is_live FROM leaders ORDER BY pnl7d DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(leaders)
    }

    pub async fn get_leader(&self, leader_id: &str) -> Result<LeaderDetail, ApiError> {
        // Get leader basic info
        let leader = sqlx::query_as::<_, Leader>(
            "SELECT leader_id, name, pnl7d, followers, is_live FROM leaders WHERE leader_id = $1"
        )
        .bind(leader_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ApiError::NotFound)?;

        // Get leader stats
        let stats = sqlx::query_as::<_, Stats>(
            "SELECT pnl7d, pnl30d, win_rate FROM leader_stats WHERE leader_id = $1"
        )
        .bind(leader_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or(Stats {
            pnl7d: 0.0,
            pnl30d: 0.0,
            win_rate: 0.0,
        });

        // Get leader's markets with full market data
        let markets = sqlx::query_as::<_, MarketSource>(
            r#"
            SELECT ms.id, ms.aggregated_event_id, ms.source, ms.market_id, ms.market_slug, 
                   ms.name, ms.status, ms.outcomes, ms.prices, ms.traded_amount, 
                   ms.resolved_outcome, ms.observed_at, ms.raw_payload, ms.created_at
            FROM leader_markets lm
            JOIN market_sources ms ON lm.market_source_id = ms.id
            WHERE lm.leader_id = $1
            ORDER BY ms.observed_at DESC
            "#
        )
        .bind(leader_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(LeaderDetail {
            leader_id: leader.leader_id,
            name: leader.name,
            stats,
            markets,
        })
    }

    // ---------- Follow Operations

    pub async fn create_follow(
        &self,
        user_id: &str,
        follow: &FollowCreate,
    ) -> Result<String, ApiError> {
        let follow_id = format!("flw_{}", Uuid::new_v4().simple());

        sqlx::query(
            r#"
            INSERT INTO follows (follow_id, user_id, leader_id, base_allocation_usdc, 
                                max_utilization_pct, max_per_trade_pct, slippage_bps, 
                                auto_close_with_leader, status, utilized_usdc)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 0.0)
            "#,
        )
        .bind(&follow_id)
        .bind(user_id)
        .bind(&follow.leader_id)
        .bind(follow.base_allocation_usdc)
        .bind(follow.max_utilization_pct)
        .bind(follow.max_per_trade_pct)
        .bind(follow.slippage_bps)
        .bind(follow.auto_close_with_leader)
        .execute(&self.pool)
        .await?;

        Ok(follow_id)
    }

    #[allow(dead_code)]
    pub async fn get_follow(&self, follow_id: &str) -> Result<Follow, ApiError> {
        let follow = sqlx::query_as::<_, Follow>(
            r#"
            SELECT follow_id, user_id, leader_id, base_allocation_usdc, 
                   max_utilization_pct, max_per_trade_pct, slippage_bps,
                   auto_close_with_leader, status, utilized_usdc, created_at
            FROM follows WHERE follow_id = $1
            "#,
        )
        .bind(follow_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ApiError::NotFound)?;

        Ok(follow)
    }

    pub async fn update_follow(
        &self,
        follow_id: &str,
        update: &FollowUpdate,
    ) -> Result<(), ApiError> {
        let mut query = String::from("UPDATE follows SET ");
        let mut updates = Vec::new();
        let mut param_count = 1;

        if update.max_utilization_pct.is_some() {
            updates.push(format!("max_utilization_pct = ${}", param_count));
            param_count += 1;
        }
        if update.max_per_trade_pct.is_some() {
            updates.push(format!("max_per_trade_pct = ${}", param_count));
            param_count += 1;
        }
        if update.slippage_bps.is_some() {
            updates.push(format!("slippage_bps = ${}", param_count));
            param_count += 1;
        }
        if update.auto_close_with_leader.is_some() {
            updates.push(format!("auto_close_with_leader = ${}", param_count));
            param_count += 1;
        }

        if updates.is_empty() {
            return Ok(());
        }

        query.push_str(&updates.join(", "));
        query.push_str(&format!(" WHERE follow_id = ${}", param_count));

        let mut q = sqlx::query(&query);

        if let Some(v) = update.max_utilization_pct {
            q = q.bind(v);
        }
        if let Some(v) = update.max_per_trade_pct {
            q = q.bind(v);
        }
        if let Some(v) = update.slippage_bps {
            q = q.bind(v);
        }
        if let Some(v) = update.auto_close_with_leader {
            q = q.bind(v);
        }
        q = q.bind(follow_id);

        q.execute(&self.pool).await?;

        Ok(())
    }

    pub async fn get_user_follows(&self, user_id: &str) -> Result<Vec<FollowView>, ApiError> {
        let rows = sqlx::query_as::<_, Follow>(
            r#"
            SELECT follow_id, user_id, leader_id, base_allocation_usdc, 
                   max_utilization_pct, max_per_trade_pct, slippage_bps,
                   auto_close_with_leader, status, utilized_usdc, created_at
            FROM follows WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let views: Vec<FollowView> = rows
            .into_iter()
            .map(|f| FollowView {
                follow_id: f.follow_id,
                leader_id: f.leader_id,
                base_allocation_usdc: f.base_allocation_usdc,
                utilization_now_pct: if f.base_allocation_usdc > 0.0 {
                    f.utilized_usdc / f.base_allocation_usdc
                } else {
                    0.0
                },
                status: f.status,
            })
            .collect();

        Ok(views)
    }

    pub async fn update_follow_status(
        &self,
        follow_id: &str,
        status: &str,
    ) -> Result<(), ApiError> {
        let result = sqlx::query("UPDATE follows SET status = $1 WHERE follow_id = $2")
            .bind(status)
            .bind(follow_id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound);
        }

        Ok(())
    }

    pub async fn unfollow_leader(
        &self,
        user_id: &str,
        leader_id: &str,
        action: &str,
    ) -> Result<(), ApiError> {
        let status = match action {
            "pause" => "paused",
            "stop" => "stopped",
            _ => return Err(ApiError::Validation("Invalid action".to_string())),
        };

        let result =
            sqlx::query("UPDATE follows SET status = $1 WHERE user_id = $2 AND leader_id = $3")
                .bind(status)
                .bind(user_id)
                .bind(leader_id)
                .execute(&self.pool)
                .await?;

        if result.rows_affected() == 0 {
            return Err(ApiError::NotFound);
        }

        Ok(())
    }

    pub async fn get_active_follows_for_leader(
        &self,
        leader_id: &str,
    ) -> Result<Vec<Follow>, ApiError> {
        let follows = sqlx::query_as::<_, Follow>(
            r#"
            SELECT follow_id, user_id, leader_id, base_allocation_usdc, 
                   max_utilization_pct, max_per_trade_pct, slippage_bps,
                   auto_close_with_leader, status, utilized_usdc, created_at
            FROM follows 
            WHERE leader_id = $1 AND status = 'active'
            "#,
        )
        .bind(leader_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(follows)
    }

    // ---------- Idempotency Operations

    #[allow(dead_code)]
    pub async fn check_idempotency(&self, key: &str) -> Result<bool, ApiError> {
        let row: (bool,) =
            sqlx::query_as("SELECT EXISTS(SELECT 1 FROM idempotency_keys WHERE key = $1)")
                .bind(key)
                .fetch_one(&self.pool)
                .await?;

        Ok(row.0)
    }

    pub async fn insert_idempotency(&self, key: &str) -> Result<bool, ApiError> {
        let result = sqlx::query(
            "INSERT INTO idempotency_keys (key) VALUES ($1) ON CONFLICT (key) DO NOTHING",
        )
        .bind(key)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    // ---------- Job Operations

    pub async fn create_replication_job(&self, job: &ReplicationJob) -> Result<(), ApiError> {
        self.execute_with_retry(|| async {
            sqlx::query(
                r#"
                INSERT INTO replication_jobs (job_id, follow_id, user_id, leader_id, venue, 
                                             market_source_id, side, size_usdc, slippage_bps, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
                "#,
            )
            .bind(&job.job_id)
            .bind(&job.follow_id)
            .bind(&job.user_id)
            .bind(&job.leader_id)
            .bind(&job.venue)
            .bind(&job.market_source_id)
            .bind(&job.side)
            .bind(job.size_usdc)
            .bind(job.slippage_bps)
            .execute(&self.pool)
            .await
        }).await?;

        Ok(())
    }

    pub async fn get_pending_jobs(&self) -> Result<Vec<ReplicationJob>, ApiError> {
        let jobs = sqlx::query_as::<_, ReplicationJob>(
            r#"
            SELECT job_id, follow_id, user_id, leader_id, venue, 
                   market_source_id, side, size_usdc, slippage_bps
            FROM replication_jobs 
            WHERE status = 'pending'
            ORDER BY created_at ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(jobs)
    }

    pub async fn get_job(&self, job_id: &str) -> Result<ReplicationJob, ApiError> {
        let job = sqlx::query_as::<_, ReplicationJob>(
            r#"
            SELECT job_id, follow_id, user_id, leader_id, venue, 
                   market_source_id, side, size_usdc, slippage_bps
            FROM replication_jobs 
            WHERE job_id = $1
            "#,
        )
        .bind(job_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ApiError::NotFound)?;

        Ok(job)
    }

    pub async fn complete_job(
        &self,
        job_id: &str,
        completion: &ReplicationComplete,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            UPDATE replication_jobs 
            SET status = $1, filled_usdc = $2, avg_price = $3, 
                venue_order_id = $4, tx_hash = $5, reason = $6
            WHERE job_id = $7
            "#,
        )
        .bind(&completion.status)
        .bind(completion.filled_usdc)
        .bind(completion.avg_price)
        .bind(&completion.venue_order_id)
        .bind(&completion.tx_hash)
        .bind(&completion.reason)
        .bind(job_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ---------- Order Operations

    pub async fn create_order(
        &self,
        user_id: &str,
        leader_id: &str,
        market_source_id: &Uuid,
        side: &str,
        size_usdc: f64,
        status: &str,
        filled_usdc: Option<f64>,
        avg_price: Option<f64>,
    ) -> Result<String, ApiError> {
        let order_id = format!("ord_{}", Uuid::new_v4().simple());

        sqlx::query(
            r#"
            INSERT INTO orders (id, user_id, leader_id, market_source_id, side, size_usdc, 
                               status, filled_usdc, avg_price)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(&order_id)
        .bind(user_id)
        .bind(leader_id)
        .bind(market_source_id)
        .bind(side)
        .bind(size_usdc)
        .bind(status)
        .bind(filled_usdc)
        .bind(avg_price)
        .execute(&self.pool)
        .await?;

        Ok(order_id)
    }

    pub async fn get_user_orders(&self, user_id: &str) -> Result<Vec<Order>, ApiError> {
        let orders = sqlx::query_as::<_, Order>(
            r#"
            SELECT id, user_id, leader_id, market_source_id, side, size_usdc, 
                   status, filled_usdc, avg_price, created_at
            FROM orders 
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(orders)
    }

    // ---------- Position Operations

    pub async fn get_user_positions(&self, user_id: &str) -> Result<Vec<Position>, ApiError> {
        let positions = sqlx::query_as::<_, Position>(
            r#"
            SELECT market_source_id, side, size_usdc, avg_price, unrealized
            FROM positions 
            WHERE user_id = $1
            ORDER BY market_source_id, side
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(positions)
    }

    pub async fn upsert_position(
        &self,
        user_id: &str,
        market_source_id: &Uuid,
        side: &str,
        size_usdc: f64,
        avg_price: f64,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            INSERT INTO positions (user_id, market_source_id, side, size_usdc, avg_price, unrealized)
            VALUES ($1, $2, $3, $4, $5, 0.0)
            ON CONFLICT (user_id, market_source_id, side) 
            DO UPDATE SET size_usdc = $4, avg_price = $5
            "#,
        )
        .bind(user_id)
        .bind(market_source_id)
        .bind(side)
        .bind(size_usdc)
        .bind(avg_price)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_position(
        &self,
        user_id: &str,
        market_source_id: &Uuid,
        side: &str,
    ) -> Result<Option<Position>, ApiError> {
        let position = sqlx::query_as::<_, Position>(
            r#"
            SELECT market_source_id, side, size_usdc, avg_price, unrealized
            FROM positions 
            WHERE user_id = $1 AND market_source_id = $2 AND side = $3
            "#,
        )
        .bind(user_id)
        .bind(market_source_id)
        .bind(side)
        .fetch_optional(&self.pool)
        .await?;

        Ok(position)
    }

    // ---------- Position Closing Operations

    pub async fn get_user_positions_for_follow(
        &self,
        user_id: &str,
        follow_id: &str,
    ) -> Result<Vec<Position>, ApiError> {
        // Get all positions for the user that are related to markets this follow is tracking
        let positions = sqlx::query_as::<_, Position>(
            r#"
            SELECT p.market_source_id, p.side, p.size_usdc, p.avg_price, p.unrealized
            FROM positions p
            JOIN leader_markets lm ON p.market_source_id = lm.market_source_id
            JOIN follows f ON lm.leader_id = f.leader_id
            WHERE f.follow_id = $1 AND f.user_id = $2
            "#,
        )
        .bind(follow_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(positions)
    }

    pub async fn create_close_job(
        &self,
        user_id: &str,
        follow_id: &str,
        market_source_id: &Uuid,
        side: &str,
        size_usdc: f64,
        _mode: &str,
        slippage_bps: i32,
    ) -> Result<String, ApiError> {
        // Validate inputs
        if size_usdc <= 0.0 {
            return Err(ApiError::Validation("Size must be positive".to_string()));
        }
        
        if !matches!(side, "buy" | "sell") {
            return Err(ApiError::Validation("Side must be 'buy' or 'sell'".to_string()));
        }
        
        if slippage_bps < 0 || slippage_bps > 10000 {
            return Err(ApiError::Validation("Slippage must be between 0 and 10000 bps".to_string()));
        }

        let job_id = format!("close_{}", Uuid::new_v4().simple());
        let opposite_side = if side == "buy" { "sell" } else { "buy" };

        self.execute_with_retry(|| async {
            sqlx::query(
                r#"
                INSERT INTO replication_jobs (job_id, follow_id, user_id, leader_id, venue, 
                                             market_source_id, side, size_usdc, slippage_bps, status)
                SELECT $1, $2, $3, f.leader_id, 'manual_close', $4, $5, $6, $7, 'pending'
                FROM follows f WHERE f.follow_id = $2 AND f.user_id = $3
                "#,
            )
            .bind(&job_id)
            .bind(follow_id)
            .bind(user_id)
            .bind(market_source_id)
            .bind(opposite_side)
            .bind(size_usdc)
            .bind(slippage_bps)
            .execute(&self.pool)
            .await
        }).await?;

        Ok(job_id)
    }

    pub async fn cleanup_old_idempotency_keys(&self, days_old: i32) -> Result<u64, ApiError> {
        let result = sqlx::query(
            "DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '1 day' * $1"
        )
        .bind(days_old)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    // Process leader trade with proper transaction handling to avoid race conditions
    pub async fn process_leader_trade(&self, evt: &LeaderTradeEvent) -> Result<usize, ApiError> {
        let mut tx = self.pool.begin().await.map_err(ApiError::Database)?;
        
        // Get active followers with row-level locking to prevent race conditions
        let follows = sqlx::query_as::<_, Follow>(
            r#"
            SELECT follow_id, user_id, leader_id, base_allocation_usdc, 
                   max_utilization_pct, max_per_trade_pct, slippage_bps, 
                   auto_close_with_leader, status, utilized_usdc, created_at
            FROM follows 
            WHERE leader_id = $1 AND status = 'active' 
            FOR UPDATE
            "#
        )
        .bind(&evt.leader_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(ApiError::Database)?;

        let mut count = 0;
        
        for follow in follows {
            let cap_total = follow.base_allocation_usdc * follow.max_utilization_pct;
            let remaining = (cap_total - follow.utilized_usdc).max(0.0);
            let cap_trade = follow.base_allocation_usdc * follow.max_per_trade_pct;
            let size = remaining.min(cap_trade);
            
            if size > 0.0 {
                let job = ReplicationJob {
                    job_id: format!("job_{}", Uuid::new_v4().simple()),
                    follow_id: follow.follow_id,
                    user_id: follow.user_id,
                    leader_id: evt.leader_id.clone(),
                    venue: evt.venue.clone(),
                    market_source_id: evt.market_source_id,
                    side: evt.side.clone(),
                    size_usdc: size,
                    slippage_bps: follow.slippage_bps,
                };
                
                // Create replication job within transaction
                sqlx::query(
                    r#"
                    INSERT INTO replication_jobs (
                        job_id, follow_id, user_id, leader_id, venue, 
                        market_source_id, side, size_usdc, slippage_bps, status, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
                    "#
                )
                .bind(&job.job_id)
                .bind(&job.follow_id)
                .bind(&job.user_id)
                .bind(&job.leader_id)
                .bind(&job.venue)
                .bind(&job.market_source_id)
                .bind(&job.side)
                .bind(&job.size_usdc)
                .bind(&job.slippage_bps)
                .execute(&mut *tx)
                .await
                .map_err(ApiError::Database)?;
                
                count += 1;
            }
        }
        
        // Commit the transaction
        tx.commit().await.map_err(ApiError::Database)?;
        
        Ok(count)
    }

}
