use anyhow::Context;
use bb8::Pool;
use bb8_postgres::PostgresConnectionManager;
use tokio_postgres::NoTls;
use crate::model::{MarketEvent, PlatformSource};
use uuid::Uuid;
use time::OffsetDateTime;

pub struct PostgresClient {
    pool: Pool<PostgresConnectionManager<NoTls>>,
}

impl PostgresClient {
    pub async fn new(url: &str) -> anyhow::Result<Self> {
        let manager = PostgresConnectionManager::new_from_stringlike(url, NoTls)
            .context("building pg manager")?;
        let pool = Pool::builder().build(manager).await.context("pg pool")?;
        Ok(Self { pool })
    }

    pub async fn ensure_schema(&self) -> anyhow::Result<()> {
        let conn = self.pool.get().await?;
        conn.batch_execute(
            r#"
            -- Aggregated events table
            CREATE TABLE IF NOT EXISTS aggregated_events (
                id uuid PRIMARY KEY,
                event_fingerprint text NOT NULL UNIQUE,
                title text NOT NULL,
                description text,
                end_time timestamptz,
                status text NOT NULL DEFAULT 'active',
                created_at timestamptz NOT NULL DEFAULT NOW(),
                updated_at timestamptz NOT NULL DEFAULT NOW()
            );

            -- Market sources for each aggregated event
            CREATE TABLE IF NOT EXISTS market_sources (
                id uuid PRIMARY KEY,
                aggregated_event_id uuid NOT NULL REFERENCES aggregated_events(id) ON DELETE CASCADE,
                source text NOT NULL,
                market_id text NOT NULL,
                market_slug text,
                name text,
                status text,
                outcomes jsonb,
                prices jsonb,
                traded_amount numeric,
                resolved_outcome text,
                observed_at timestamptz NOT NULL,
                raw_payload jsonb NOT NULL,
                created_at timestamptz NOT NULL DEFAULT NOW()
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_aggregated_events_fingerprint ON aggregated_events(event_fingerprint);
            CREATE INDEX IF NOT EXISTS idx_aggregated_events_status ON aggregated_events(status);
            CREATE INDEX IF NOT EXISTS idx_market_sources_event_id ON market_sources(aggregated_event_id);
            CREATE INDEX IF NOT EXISTS idx_market_sources_source ON market_sources(source);
            CREATE INDEX IF NOT EXISTS idx_market_sources_market_id ON market_sources(market_id);
            
            -- Constraints to prevent data corruption
            ALTER TABLE market_sources 
            ADD CONSTRAINT IF NOT EXISTS unique_market_source 
            UNIQUE (aggregated_event_id, source, market_id);
            
            -- Ensure market_id cannot be empty
            ALTER TABLE market_sources 
            ADD CONSTRAINT IF NOT EXISTS check_market_id_not_empty 
            CHECK (length(trim(market_id)) > 0);
            
            -- Ensure source is not empty
            ALTER TABLE market_sources 
            ADD CONSTRAINT IF NOT EXISTS check_source_not_empty 
            CHECK (length(trim(source)) > 0);
            
            -- Ensure title is not empty
            ALTER TABLE aggregated_events 
            ADD CONSTRAINT IF NOT EXISTS check_title_not_empty 
            CHECK (length(trim(title)) > 0);
            
            -- Ensure event_fingerprint is not empty
            ALTER TABLE aggregated_events 
            ADD CONSTRAINT IF NOT EXISTS check_fingerprint_not_empty 
            CHECK (length(trim(event_fingerprint)) > 0);
            "#,
        )
        .await?;
        Ok(())
    }

    pub async fn store_or_update_event(&self, event: &MarketEvent) -> anyhow::Result<()> {
        let conn = self.pool.get().await?;
        
        // Check if aggregated event exists for this fingerprint
        if let Some(fingerprint) = &event.event_fingerprint {
            let existing_event = conn
                .query_opt(
                    "SELECT id FROM aggregated_events WHERE event_fingerprint = $1",
                    &[fingerprint]
                )
                .await?;

            if let Some(row) = existing_event {
                // Update existing aggregated event
                let aggregated_event_id: Uuid = row.get(0);
                self.add_market_source(&conn, aggregated_event_id, event).await?;
                
                // Update the aggregated event's updated_at timestamp
                conn.execute(
                    "UPDATE aggregated_events SET updated_at = NOW() WHERE id = $1",
                    &[&aggregated_event_id]
                ).await?;
            } else {
                // Create new aggregated event
                self.create_new_aggregated_event(&conn, event).await?;
            }
        } else {
            // No fingerprint, create standalone event
            self.create_new_aggregated_event(&conn, event).await?;
        }
        
        Ok(())
    }

    async fn create_new_aggregated_event(&self, conn: &bb8::PooledConnection<'_, PostgresConnectionManager<NoTls>>, event: &MarketEvent) -> anyhow::Result<()> {
        let aggregated_event_id = Uuid::new_v4();
        let fingerprint = event.event_fingerprint.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
        
        // Extract title from event payload
        let title = self.extract_title_from_event(event);
        let description = self.extract_description_from_event(event);
        let end_time = self.extract_end_time_from_event(event);
        let status = self.extract_status_from_event(event);

        // Insert aggregated event
        let end_time_str = end_time.map(|dt| dt.to_string());
        conn.execute(
            r#"
            INSERT INTO aggregated_events (id, event_fingerprint, title, description, end_time, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            &[&aggregated_event_id, &fingerprint, &title, &description, &end_time_str, &status]
        ).await?;

        // Add the market source
        self.add_market_source(conn, aggregated_event_id, event).await?;
        
        Ok(())
    }

    async fn add_market_source(&self, conn: &bb8::PooledConnection<'_, PostgresConnectionManager<NoTls>>, aggregated_event_id: Uuid, event: &MarketEvent) -> anyhow::Result<()> {
        let market_source_id = Uuid::new_v4();
        
        // Check if this market source already exists
        let existing = conn
            .query_opt(
                "SELECT id FROM market_sources WHERE aggregated_event_id = $1 AND source = $2 AND market_id = $3",
                &[&aggregated_event_id, &event.source.to_string(), &event.market_id]
            )
            .await?;

        if existing.is_some() {
            // Update existing market source
            conn.execute(
                r#"
                UPDATE market_sources 
                SET name = $1, status = $2, outcomes = $3, prices = $4, traded_amount = $5, 
                    resolved_outcome = $6, observed_at = $7, raw_payload = $8
                WHERE aggregated_event_id = $9 AND source = $10 AND market_id = $11
                "#,
                &[
                    &self.extract_name_from_event(event),
                    &self.extract_status_from_event(event),
                    &self.extract_outcomes_from_event(event),
                    &self.extract_prices_from_event(event),
                    &self.extract_traded_amount_from_event(event),
                    &self.extract_resolved_outcome_from_event(event),
                    &event.observed_at.to_string(),
                    &event.payload,
                    &aggregated_event_id,
                    &event.source.to_string(),
                    &event.market_id
                ]
            ).await?;
        } else {
            // Insert new market source
            conn.execute(
                r#"
                INSERT INTO market_sources (
                    id, aggregated_event_id, source, market_id, market_slug, name, status,
                    outcomes, prices, traded_amount, resolved_outcome, observed_at, raw_payload
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                "#,
                &[
                    &market_source_id,
                    &aggregated_event_id,
                    &event.source.to_string(),
                    &event.market_id,
                    &self.extract_slug_from_event(event),
                    &self.extract_name_from_event(event),
                    &self.extract_status_from_event(event),
                    &self.extract_outcomes_from_event(event),
                    &self.extract_prices_from_event(event),
                    &self.extract_traded_amount_from_event(event),
                    &self.extract_resolved_outcome_from_event(event),
                    &event.observed_at.to_string(),
                    &event.payload
                ]
            ).await?;
        }
        
        Ok(())
    }

    // Helper methods to extract data from events
    fn extract_title_from_event(&self, event: &MarketEvent) -> String {
        match event.source {
            PlatformSource::Polymarket => {
                event.payload.get("title")
                    .or_else(|| event.payload.get("question"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown Event")
                    .to_string()
            },
            PlatformSource::Augur => {
                event.payload.get("data")
                    .and_then(|d| d.get("markets"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("title"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("Unknown Event")
                    .to_string()
            },
            PlatformSource::Kalshi => {
                event.payload.get("data")
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("title"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("Unknown Event")
                    .to_string()
            },
            PlatformSource::Thales => {
                event.payload.get("data")
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("question"))
                    .and_then(|q| q.as_str())
                    .unwrap_or("Unknown Event")
                    .to_string()
            },
            PlatformSource::Omen => {
                event.payload.get("data")
                    .and_then(|d| d.get("markets"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("question"))
                    .and_then(|q| q.as_str())
                    .unwrap_or("Unknown Event")
                    .to_string()
            },
        }
    }

    fn extract_description_from_event(&self, _event: &MarketEvent) -> Option<String> {
        // Could be enhanced to extract descriptions from specific platforms
        None
    }

    fn extract_end_time_from_event(&self, event: &MarketEvent) -> Option<OffsetDateTime> {
        match event.source {
            PlatformSource::Polymarket => {
                event.payload.get("end_time")
                    .and_then(|v| v.as_str())
                    .and_then(|s| time::OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok())
            },
            PlatformSource::Augur => {
                event.payload.get("data")
                    .and_then(|d| d.get("markets"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("endTime"))
                    .and_then(|t| t.as_str())
                    .and_then(|s| time::OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok())
            },
            PlatformSource::Kalshi => {
                event.payload.get("data")
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("close_time"))
                    .and_then(|t| t.as_str())
                    .and_then(|s| time::OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok())
            },
            PlatformSource::Thales => {
                event.payload.get("data")
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("end_of_round"))
                    .and_then(|t| t.as_str())
                    .and_then(|s| time::OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok())
            },
            PlatformSource::Omen => {
                event.payload.get("data")
                    .and_then(|d| d.get("markets"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("end_date"))
                    .and_then(|t| t.as_str())
                    .and_then(|s| time::OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok())
            },
        }
    }

    fn extract_status_from_event(&self, event: &MarketEvent) -> String {
        event.payload.get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("active")
            .to_string()
    }

    fn extract_name_from_event(&self, event: &MarketEvent) -> Option<String> {
        event.payload.get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    fn extract_slug_from_event(&self, event: &MarketEvent) -> Option<String> {
        event.payload.get("slug")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    fn extract_outcomes_from_event(&self, event: &MarketEvent) -> Option<serde_json::Value> {
        event.payload.get("outcomes")
            .map(|v| v.clone())
    }

    fn extract_prices_from_event(&self, event: &MarketEvent) -> Option<serde_json::Value> {
        event.payload.get("prices")
            .map(|v| v.clone())
    }

    fn extract_traded_amount_from_event(&self, event: &MarketEvent) -> Option<f64> {
        event.payload.get("traded_amount")
            .and_then(|v| v.as_f64())
    }

    fn extract_resolved_outcome_from_event(&self, event: &MarketEvent) -> Option<String> {
        event.payload.get("resolved_outcome")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }
}



