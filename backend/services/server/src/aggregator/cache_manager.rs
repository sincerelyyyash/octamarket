use crate::models::BestPrice;
use sqlx::PgPool;

/// Manages the best_prices_cache table
pub struct CacheManager {
    pool: PgPool,
}

impl CacheManager {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Update cache with new best prices
    pub async fn update_cache(&self, best_prices: Vec<BestPrice>) -> Result<(), sqlx::Error> {
        for price in best_prices {
            sqlx::query(
                r#"
                INSERT INTO best_prices_cache (
                    event_fingerprint, event_title,
                    best_yes_price, best_yes_platform, best_yes_market_id,
                    best_no_price, best_no_platform, best_no_market_id,
                    last_updated
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (event_fingerprint) DO UPDATE SET
                    event_title = EXCLUDED.event_title,
                    best_yes_price = EXCLUDED.best_yes_price,
                    best_yes_platform = EXCLUDED.best_yes_platform,
                    best_yes_market_id = EXCLUDED.best_yes_market_id,
                    best_no_price = EXCLUDED.best_no_price,
                    best_no_platform = EXCLUDED.best_no_platform,
                    best_no_market_id = EXCLUDED.best_no_market_id,
                    last_updated = EXCLUDED.last_updated
                "#
            )
            .bind(&price.event_fingerprint)
            .bind(&price.event_title)
            .bind(price.best_yes_price)
            .bind(&price.best_yes_platform)
            .bind(&price.best_yes_market_id)
            .bind(price.best_no_price)
            .bind(&price.best_no_platform)
            .bind(&price.best_no_market_id)
            .bind(price.last_updated)
            .execute(&self.pool)
            .await?;
        }
        
        Ok(())
    }

    /// Get cached best price for an event
    pub async fn get_cached_price(&self, event_fingerprint: &str) -> Result<Option<BestPrice>, sqlx::Error> {
        let price = sqlx::query_as::<_, BestPrice>(
            r#"
            SELECT 
                event_fingerprint, event_title,
                best_yes_price, best_yes_platform, best_yes_market_id,
                best_no_price, best_no_platform, best_no_market_id,
                last_updated
            FROM best_prices_cache
            WHERE event_fingerprint = $1
            "#
        )
        .bind(event_fingerprint)
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(price)
    }

    /// Get all cached best prices
    pub async fn get_all_cached_prices(&self) -> Result<Vec<BestPrice>, sqlx::Error> {
        let prices = sqlx::query_as::<_, BestPrice>(
            r#"
            SELECT 
                event_fingerprint, event_title,
                best_yes_price, best_yes_platform, best_yes_market_id,
                best_no_price, best_no_platform, best_no_market_id,
                last_updated
            FROM best_prices_cache
            ORDER BY last_updated DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;
        
        Ok(prices)
    }

    /// Start periodic cache refresh
    pub async fn start_periodic_refresh<F>(&self, interval_seconds: u64, refresh_fn: F)
    where
        F: Fn() -> Vec<BestPrice> + Send + 'static,
    {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(interval_seconds));
        
        loop {
            interval.tick().await;
            
            let best_prices = refresh_fn();
            
            if let Err(e) = self.update_cache(best_prices).await {
                tracing::error!(error = %e, "Failed to update best prices cache");
            } else {
                tracing::debug!("Best prices cache updated successfully");
            }
        }
    }
}


