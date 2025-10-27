use crate::models::{ArbitrageOpportunity, ArbitrageAlert};
use crate::arbitrage::analyzer::ArbitrageAnalyzer;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;

/// Manages arbitrage alerts in the database
pub struct AlertManager {
    pool: PgPool,
    analyzer: ArbitrageAnalyzer,
}

impl AlertManager {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            analyzer: ArbitrageAnalyzer::new(),
        }
    }

    /// Create alert from opportunity
    pub async fn create_alert(&self, opportunity: ArbitrageOpportunity) -> Result<String, sqlx::Error> {
        let alert_id = Uuid::new_v4().to_string();
        let _risk = self.analyzer.analyze_risk(&opportunity);
        let min_capital = self.analyzer.calculate_min_capital(&opportunity, 10.0); // $10 target profit
        let profit_amount = self.analyzer.calculate_profit(&opportunity, min_capital);
        
        // Determine opportunity type
        let opportunity_type = if opportunity.buy_side.platform == opportunity.sell_side.platform {
            "same_platform"
        } else {
            "cross_platform"
        };
        
        sqlx::query(
            r#"
            INSERT INTO arbitrage_alerts (
                id, event_fingerprint, event_title, opportunity_type,
                profit_pct, profit_amount_usd,
                buy_platform, buy_market_id, buy_outcome, buy_price,
                sell_platform, sell_market_id, sell_outcome, sell_price,
                min_capital_required, detected_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            "#
        )
        .bind(&alert_id)
        .bind(&opportunity.event_fingerprint)
        .bind(&opportunity.event_title)
        .bind(opportunity_type)
        .bind(opportunity.profit_pct)
        .bind(profit_amount)
        .bind(&opportunity.buy_side.platform)
        .bind(&opportunity.buy_side.market_id)
        .bind(&opportunity.buy_side.outcome)
        .bind(opportunity.buy_side.price)
        .bind(&opportunity.sell_side.platform)
        .bind(&opportunity.sell_side.market_id)
        .bind(&opportunity.sell_side.outcome)
        .bind(opportunity.sell_side.price)
        .bind(min_capital)
        .bind(Utc::now())
        .bind("active")
        .execute(&self.pool)
        .await?;
        
        Ok(alert_id)
    }

    /// Get active arbitrage alerts
    pub async fn get_active_alerts(&self, limit: Option<i64>) -> Result<Vec<ArbitrageAlert>, sqlx::Error> {
        let limit_val = limit.unwrap_or(50);
        
        let alerts = sqlx::query_as::<_, ArbitrageAlert>(
            r#"
            SELECT *
            FROM arbitrage_alerts
            WHERE status = 'active'
            ORDER BY profit_pct DESC
            LIMIT $1
            "#
        )
        .bind(limit_val)
        .fetch_all(&self.pool)
        .await?;
        
        Ok(alerts)
    }

    /// Mark alert as executed
    pub async fn mark_executed(&self, alert_id: &str, user_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE arbitrage_alerts
            SET status = 'executed', executed_by = $1, executed_at = $2
            WHERE id = $3
            "#
        )
        .bind(user_id)
        .bind(Utc::now())
        .bind(alert_id)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    /// Expire old alerts
    pub async fn expire_old_alerts(&self, max_age_seconds: i64) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            r#"
            UPDATE arbitrage_alerts
            SET status = 'expired'
            WHERE status = 'active'
              AND detected_at < NOW() - INTERVAL '1 second' * $1
            "#
        )
        .bind(max_age_seconds)
        .execute(&self.pool)
        .await?;
        
        Ok(result.rows_affected())
    }

    /// Start periodic alert scanning
    pub async fn start_periodic_scanning<F>(&self, interval_seconds: u64, scan_fn: F)
    where
        F: Fn() -> Vec<ArbitrageOpportunity> + Send + 'static,
    {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(interval_seconds));
        
        loop {
            interval.tick().await;
            
            // Scan for new opportunities
            let opportunities = scan_fn();
            
            // Create alerts for each opportunity
            for opp in opportunities {
                if let Err(e) = self.create_alert(opp).await {
                    tracing::error!(error = %e, "Failed to create arbitrage alert");
                }
            }
            
            // Expire old alerts (older than 5 minutes)
            if let Err(e) = self.expire_old_alerts(300).await {
                tracing::error!(error = %e, "Failed to expire old arbitrage alerts");
            }
        }
    }
}


