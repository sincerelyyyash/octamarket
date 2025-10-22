use anyhow::Context;
use bb8::Pool;
use bb8_postgres::PostgresConnectionManager;
use tokio_postgres::NoTls;
use crate::model::{MarketEvent, PlatformSource};
use uuid::Uuid;
use time::OffsetDateTime;

#[derive(Clone)]
pub struct PostgresClient {
    pub pool: Pool<PostgresConnectionManager<NoTls>>,
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

            -- Price history table for tracking price changes over time
            CREATE TABLE IF NOT EXISTS price_history (
                id uuid PRIMARY KEY,
                market_source_id uuid NOT NULL REFERENCES market_sources(id) ON DELETE CASCADE,
                outcome_index integer NOT NULL,
                outcome_name text NOT NULL,
                price numeric NOT NULL,
                volume numeric,
                timestamp timestamptz NOT NULL DEFAULT NOW(),
                source_data jsonb
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_aggregated_events_fingerprint ON aggregated_events(event_fingerprint);
            CREATE INDEX IF NOT EXISTS idx_aggregated_events_status ON aggregated_events(status);
            CREATE INDEX IF NOT EXISTS idx_market_sources_event_id ON market_sources(aggregated_event_id);
            CREATE INDEX IF NOT EXISTS idx_market_sources_source ON market_sources(source);
            CREATE INDEX IF NOT EXISTS idx_market_sources_market_id ON market_sources(market_id);
            CREATE INDEX IF NOT EXISTS idx_price_history_market_source ON price_history(market_source_id);
            CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_price_history_outcome ON price_history(outcome_index, outcome_name);
            
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
            
            // Store price history for the updated market source
            if let (Some(prices), Some(outcomes)) = (
                self.extract_prices_from_event(event),
                self.extract_outcomes_from_event(event)
            ) {
                // Get the market source ID for price history
                if let Ok(Some(row)) = conn.query_opt(
                    "SELECT id FROM market_sources WHERE aggregated_event_id = $1 AND source = $2 AND market_id = $3",
                    &[&aggregated_event_id, &event.source.to_string(), &event.market_id]
                ).await {
                    let market_source_id: Uuid = row.get(0);
                    if let Err(e) = self.store_price_history(market_source_id, &prices, &outcomes, event.observed_at).await {
                        tracing::warn!(error = %e, "failed to store price history for market source");
                    }
                }
            }
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
            
            // Store price history for the new market source
            if let (Some(prices), Some(outcomes)) = (
                self.extract_prices_from_event(event),
                self.extract_outcomes_from_event(event)
            ) {
                if let Err(e) = self.store_price_history(market_source_id, &prices, &outcomes, event.observed_at).await {
                    tracing::warn!(error = %e, "failed to store price history for new market source");
                }
            }
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
        match event.source {
            PlatformSource::Polymarket => {
                event.payload.get("outcomes")
                    .or_else(|| event.payload.get("outcome_tokens"))
                    .or_else(|| {
                        // Try to extract from orderbook data
                        event.payload.get("orderbook")
                            .and_then(|ob| ob.get("outcomes"))
                    })
                    .map(|v| v.clone())
            },
            PlatformSource::Augur => {
                event.payload.get("data")
                    .and_then(|d| d.get("markets"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("outcomes"))
                    .map(|outcomes| {
                        if let Some(outcomes_array) = outcomes.as_array() {
                            let outcome_names: Vec<String> = outcomes_array.iter()
                                .filter_map(|outcome| outcome.get("name").and_then(|n| n.as_str()))
                                .map(|s| s.to_string())
                                .collect();
                            if !outcome_names.is_empty() {
                                return serde_json::Value::Array(
                                    outcome_names.into_iter().map(|name| serde_json::Value::String(name)).collect()
                                );
                            }
                        }
                        outcomes.clone()
                    })
            },
            PlatformSource::Kalshi => {
                event.payload.get("data")
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("outcomes"))
                    .map(|outcomes| {
                        if let Some(outcomes_array) = outcomes.as_array() {
                            let outcome_names: Vec<String> = outcomes_array.iter()
                                .filter_map(|outcome| outcome.get("name").and_then(|n| n.as_str()))
                                .map(|s| s.to_string())
                                .collect();
                            if !outcome_names.is_empty() {
                                return serde_json::Value::Array(
                                    outcome_names.into_iter().map(|name| serde_json::Value::String(name)).collect()
                                );
                            }
                        }
                        outcomes.clone()
                    })
            },
            PlatformSource::Thales => {
                event.payload.get("data")
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("outcomes"))
                    .map(|outcomes| {
                        if let Some(outcomes_array) = outcomes.as_array() {
                            let outcome_names: Vec<String> = outcomes_array.iter()
                                .filter_map(|outcome| outcome.get("name").and_then(|n| n.as_str()))
                                .map(|s| s.to_string())
                                .collect();
                            if !outcome_names.is_empty() {
                                return serde_json::Value::Array(
                                    outcome_names.into_iter().map(|name| serde_json::Value::String(name)).collect()
                                );
                            }
                        }
                        outcomes.clone()
                    })
            },
            PlatformSource::Omen => {
                event.payload.get("data")
                    .and_then(|d| d.get("markets"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("outcomes"))
                    .map(|outcomes| {
                        if let Some(outcomes_array) = outcomes.as_array() {
                            let outcome_names: Vec<String> = outcomes_array.iter()
                                .filter_map(|outcome| outcome.get("name").and_then(|n| n.as_str()))
                                .map(|s| s.to_string())
                                .collect();
                            if !outcome_names.is_empty() {
                                return serde_json::Value::Array(
                                    outcome_names.into_iter().map(|name| serde_json::Value::String(name)).collect()
                                );
                            }
                        }
                        outcomes.clone()
                    })
            },
        }
    }

    fn extract_prices_from_event(&self, event: &MarketEvent) -> Option<serde_json::Value> {
        match event.source {
            PlatformSource::Polymarket => {
                // Polymarket prices can be in different formats
                event.payload.get("prices")
                    .or_else(|| event.payload.get("outcome_prices"))
                    .map(|v| v.clone())
            },
            PlatformSource::Augur => {
                event.payload.get("data")
                    .and_then(|d| d.get("markets"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("outcomes"))
                    .and_then(|outcomes| {
                        if let Some(outcomes_array) = outcomes.as_array() {
                            let prices: Vec<f64> = outcomes_array.iter()
                                .filter_map(|outcome| outcome.get("price").and_then(|p| p.as_f64()))
                                .collect();
                            if !prices.is_empty() {
                                return Some(serde_json::Value::Array(
                                    prices.into_iter().map(|p| serde_json::Value::Number(
                                        serde_json::Number::from_f64(p).unwrap_or(serde_json::Number::from(0))
                                    )).collect()
                                ));
                            }
                        }
                        None
                    })
            },
            PlatformSource::Kalshi => {
                event.payload.get("data")
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("outcomes"))
                    .and_then(|outcomes| {
                        if let Some(outcomes_array) = outcomes.as_array() {
                            let prices: Vec<f64> = outcomes_array.iter()
                                .filter_map(|outcome| outcome.get("price").and_then(|p| p.as_f64()))
                                .collect();
                            if !prices.is_empty() {
                                return Some(serde_json::Value::Array(
                                    prices.into_iter().map(|p| serde_json::Value::Number(
                                        serde_json::Number::from_f64(p).unwrap_or(serde_json::Number::from(0))
                                    )).collect()
                                ));
                            }
                        }
                        None
                    })
            },
            PlatformSource::Thales => {
                event.payload.get("data")
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("outcomes"))
                    .and_then(|outcomes| {
                        if let Some(outcomes_array) = outcomes.as_array() {
                            let prices: Vec<f64> = outcomes_array.iter()
                                .filter_map(|outcome| outcome.get("price").and_then(|p| p.as_f64()))
                                .collect();
                            if !prices.is_empty() {
                                return Some(serde_json::Value::Array(
                                    prices.into_iter().map(|p| serde_json::Value::Number(
                                        serde_json::Number::from_f64(p).unwrap_or(serde_json::Number::from(0))
                                    )).collect()
                                ));
                            }
                        }
                        None
                    })
            },
            PlatformSource::Omen => {
                event.payload.get("data")
                    .and_then(|d| d.get("markets"))
                    .and_then(|m| m.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|market| market.get("outcomes"))
                    .and_then(|outcomes| {
                        if let Some(outcomes_array) = outcomes.as_array() {
                            let prices: Vec<f64> = outcomes_array.iter()
                                .filter_map(|outcome| outcome.get("price").and_then(|p| p.as_f64()))
                                .collect();
                            if !prices.is_empty() {
                                return Some(serde_json::Value::Array(
                                    prices.into_iter().map(|p| serde_json::Value::Number(
                                        serde_json::Number::from_f64(p).unwrap_or(serde_json::Number::from(0))
                                    )).collect()
                                ));
                            }
                        }
                        None
                    })
            },
        }
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

    // Store price history for a market source
    pub async fn store_price_history(&self, market_source_id: Uuid, prices: &serde_json::Value, outcomes: &serde_json::Value, timestamp: OffsetDateTime) -> anyhow::Result<()> {
        let conn = self.pool.get().await?;
        
        // Extract prices and outcomes based on platform
        let price_data = self.extract_price_data_from_payload(prices, outcomes);
        
        for (index, price_entry) in price_data.iter().enumerate() {
            let price_history_id = Uuid::new_v4();
            
            conn.execute(
                r#"
                INSERT INTO price_history (id, market_source_id, outcome_index, outcome_name, price, volume, timestamp, source_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                "#,
                &[
                    &price_history_id,
                    &market_source_id,
                    &(index as i32),
                    &price_entry.outcome_name,
                    &price_entry.price,
                    &price_entry.volume,
                    &timestamp.to_string(),
                    &price_entry.source_data
                ]
            ).await?;
        }
        
        Ok(())
    }

    // Get market source ID for a specific event
    pub async fn get_market_source_id(&self, event: &MarketEvent) -> anyhow::Result<Option<Uuid>> {
        let conn = self.pool.get().await?;
        
        if let Some(fingerprint) = &event.event_fingerprint {
            let row = conn.query_opt(
                r#"
                SELECT ms.id FROM market_sources ms
                JOIN aggregated_events ae ON ms.aggregated_event_id = ae.id
                WHERE ae.event_fingerprint = $1 AND ms.source = $2 AND ms.market_id = $3
                "#,
                &[fingerprint, &event.source.to_string(), &event.market_id]
            ).await?;
            
            if let Some(row) = row {
                return Ok(Some(row.get("id")));
            }
        }
        
        Ok(None)
    }


    // Extract structured price data from platform-specific payloads
    fn extract_price_data_from_payload(&self, prices: &serde_json::Value, outcomes: &serde_json::Value) -> Vec<PriceEntry> {
        let mut price_entries = Vec::new();
        
        // Handle different price formats from different platforms
        if let Some(prices_array) = prices.as_array() {
            for (index, price_value) in prices_array.iter().enumerate() {
                if let Some(price_num) = price_value.as_f64() {
                    let outcome_name = outcomes
                        .as_array()
                        .and_then(|arr| arr.get(index))
                        .and_then(|v| v.as_str())
                        .unwrap_or(&format!("Outcome {}", index + 1))
                        .to_string();
                    
                    price_entries.push(PriceEntry {
                        outcome_name,
                        price: price_num,
                        volume: None,
                        source_data: serde_json::Value::Null,
                    });
                }
            }
        } else if let Some(prices_obj) = prices.as_object() {
            for (outcome_name, price_value) in prices_obj {
                if let Some(price_num) = price_value.as_f64() {
                    price_entries.push(PriceEntry {
                        outcome_name: outcome_name.clone(),
                        price: price_num,
                        volume: None,
                        source_data: serde_json::Value::Null,
                    });
                }
            }
        }
        
        price_entries
    }

    // Get latest prices for all markets of an event
    pub async fn get_latest_prices_for_event(&self, event_fingerprint: &str) -> anyhow::Result<Vec<EventPriceData>> {
        let conn = self.pool.get().await?;
        
        let rows = conn.query(
            r#"
            SELECT 
                ae.event_fingerprint,
                ae.title,
                ms.source,
                ms.market_id,
                ms.name,
                ms.prices,
                ms.outcomes,
                ms.observed_at,
                ms.traded_amount
            FROM aggregated_events ae
            JOIN market_sources ms ON ae.id = ms.aggregated_event_id
            WHERE ae.event_fingerprint = $1
            ORDER BY ms.observed_at DESC
            "#,
            &[&event_fingerprint]
        ).await?;
        
        let mut event_prices = Vec::new();
        for row in rows {
            event_prices.push(EventPriceData {
                event_fingerprint: row.get("event_fingerprint"),
                event_title: row.get("title"),
                source: row.get("source"),
                market_id: row.get("market_id"),
                market_name: row.get("name"),
                prices: row.get("prices"),
                outcomes: row.get("outcomes"),
                observed_at: row.get("observed_at"),
                traded_amount: row.get("traded_amount"),
            });
        }
        
        Ok(event_prices)
    }

    // Get price history for a specific market
    pub async fn get_price_history_for_market(&self, market_source_id: Uuid, limit: Option<i64>) -> anyhow::Result<Vec<PriceHistoryEntry>> {
        let conn = self.pool.get().await?;
        
        let limit_clause = if let Some(limit) = limit {
            format!("LIMIT {}", limit)
        } else {
            String::new()
        };
        
        let query = format!(
            r#"
            SELECT outcome_index, outcome_name, price, volume, timestamp, source_data
            FROM price_history
            WHERE market_source_id = $1
            ORDER BY timestamp DESC
            {}
            "#,
            limit_clause
        );
        
        let rows = conn.query(&query, &[&market_source_id]).await?;
        
        let mut history = Vec::new();
        for row in rows {
            history.push(PriceHistoryEntry {
                outcome_index: row.get("outcome_index"),
                outcome_name: row.get("outcome_name"),
                price: row.get("price"),
                volume: row.get("volume"),
                timestamp: row.get("timestamp"),
                source_data: row.get("source_data"),
            });
        }
        
        Ok(history)
    }
}

// Helper structs for price data
#[derive(Debug, Clone)]
struct PriceEntry {
    outcome_name: String,
    price: f64,
    volume: Option<f64>,
    source_data: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct EventPriceData {
    pub event_fingerprint: String,
    pub event_title: String,
    pub source: String,
    pub market_id: String,
    pub market_name: Option<String>,
    pub prices: Option<serde_json::Value>,
    pub outcomes: Option<serde_json::Value>,
    pub observed_at: String,
    pub traded_amount: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct PriceHistoryEntry {
    pub outcome_index: i32,
    pub outcome_name: String,
    pub price: f64,
    pub volume: Option<f64>,
    pub timestamp: String,
    pub source_data: serde_json::Value,
}



