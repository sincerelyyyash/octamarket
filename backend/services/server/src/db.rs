use crate::errors::ApiError;
use crate::models::*;
use sqlx::{PgPool, postgres::PgPoolOptions};
use uuid::Uuid;

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    #[allow(dead_code)]
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    // ---------- User Operations

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
        .execute(&self.pool)
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
        #[derive(sqlx::FromRow)]
        struct LeaderDetailRow {
            leader_id: String,
            name: String,
            pnl7d: f64,
            pnl30d: f64,
            win_rate: f64,
            markets: Vec<String>,
        }

        let row = sqlx::query_as::<_, LeaderDetailRow>(
            r#"
            SELECT l.leader_id, l.name, ls.pnl7d, ls.pnl30d, ls.win_rate, 
                   COALESCE(array_agg(lm.market_id) FILTER (WHERE lm.market_id IS NOT NULL), '{}') as markets
            FROM leaders l
            JOIN leader_stats ls ON l.leader_id = ls.leader_id
            LEFT JOIN leader_markets lm ON l.leader_id = lm.leader_id
            WHERE l.leader_id = $1
            GROUP BY l.leader_id, l.name, ls.pnl7d, ls.pnl30d, ls.win_rate
            "#
        )
        .bind(leader_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ApiError::NotFound)?;

        Ok(LeaderDetail {
            leader_id: row.leader_id,
            name: row.name,
            stats: Stats {
                pnl7d: row.pnl7d,
                pnl30d: row.pnl30d,
                win_rate: row.win_rate,
            },
            markets: row.markets,
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
        sqlx::query(
            r#"
            INSERT INTO replication_jobs (job_id, follow_id, user_id, leader_id, venue, 
                                         market_id, side, size_usdc, slippage_bps, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
            "#,
        )
        .bind(&job.job_id)
        .bind(&job.follow_id)
        .bind(&job.user_id)
        .bind(&job.leader_id)
        .bind(&job.venue)
        .bind(&job.market_id)
        .bind(&job.side)
        .bind(job.size_usdc)
        .bind(job.slippage_bps)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_pending_jobs(&self) -> Result<Vec<ReplicationJob>, ApiError> {
        let jobs = sqlx::query_as::<_, ReplicationJob>(
            r#"
            SELECT job_id, follow_id, user_id, leader_id, venue, 
                   market_id, side, size_usdc, slippage_bps
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
                   market_id, side, size_usdc, slippage_bps
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
        market_id: &str,
        side: &str,
        size_usdc: f64,
        status: &str,
        filled_usdc: Option<f64>,
        avg_price: Option<f64>,
    ) -> Result<String, ApiError> {
        let order_id = format!("ord_{}", Uuid::new_v4().simple());

        sqlx::query(
            r#"
            INSERT INTO orders (id, user_id, leader_id, market_id, side, size_usdc, 
                               status, filled_usdc, avg_price)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(&order_id)
        .bind(user_id)
        .bind(leader_id)
        .bind(market_id)
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
            SELECT id, user_id, leader_id, market_id, side, size_usdc, 
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
            SELECT market_id, side, size_usdc, avg_price, unrealized
            FROM positions 
            WHERE user_id = $1
            ORDER BY market_id, side
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
        market_id: &str,
        side: &str,
        size_usdc: f64,
        avg_price: f64,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            INSERT INTO positions (user_id, market_id, side, size_usdc, avg_price, unrealized)
            VALUES ($1, $2, $3, $4, $5, 0.0)
            ON CONFLICT (user_id, market_id, side) 
            DO UPDATE SET size_usdc = $4, avg_price = $5
            "#,
        )
        .bind(user_id)
        .bind(market_id)
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
        market_id: &str,
        side: &str,
    ) -> Result<Option<Position>, ApiError> {
        let position = sqlx::query_as::<_, Position>(
            r#"
            SELECT market_id, side, size_usdc, avg_price, unrealized
            FROM positions 
            WHERE user_id = $1 AND market_id = $2 AND side = $3
            "#,
        )
        .bind(user_id)
        .bind(market_id)
        .bind(side)
        .fetch_optional(&self.pool)
        .await?;

        Ok(position)
    }

}
