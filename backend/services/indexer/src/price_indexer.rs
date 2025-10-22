use crate::model::{MarketEvent, PlatformSource, PriceSnapshot, OutcomePrice};
use crate::clients::postgres::{EventPriceData, PriceHistoryEntry};
use crate::clients::postgres::PostgresClient;
use time::OffsetDateTime;
use uuid::Uuid;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Clone)]
pub struct PriceIndexer {
    postgres: PostgresClient,
}

impl PriceIndexer {
    pub fn new(postgres: PostgresClient) -> Self {
        Self { postgres }
    }

    /// Index prices from a market event
    pub async fn index_prices_from_event(&self, event: &MarketEvent) -> anyhow::Result<()> {
        // Extract prices and outcomes from the event
        let prices = self.extract_prices_from_event(event);
        let outcomes = self.extract_outcomes_from_event(event);

        if let (Some(prices), Some(outcomes)) = (prices, outcomes) {
            // Store the event first to get the market source ID
            self.postgres.store_or_update_event(event).await?;
            
            // Get the market source ID for price history storage
            if let Some(market_source_id) = self.get_market_source_id(event).await? {
                // Store price history
                self.postgres.store_price_history(
                    market_source_id,
                    &prices,
                    &outcomes,
                    event.observed_at
                ).await?;
                
                tracing::info!(
                    source = %event.source,
                    market_id = %event.market_id,
                    "successfully indexed prices for market"
                );
            }
        }

        Ok(())
    }

    /// Get all prices for a specific event across all sources
    pub async fn get_event_prices(&self, event_fingerprint: &str) -> anyhow::Result<Vec<EventPriceData>> {
        self.postgres.get_latest_prices_for_event(event_fingerprint).await
    }

    /// Get price history for a specific market
    pub async fn get_market_price_history(&self, market_source_id: Uuid, limit: Option<i64>) -> anyhow::Result<Vec<PriceHistoryEntry>> {
        self.postgres.get_price_history_for_market(market_source_id, limit).await
    }

    /// Get price snapshots for an event at a specific time
    pub async fn get_price_snapshots(&self, event_fingerprint: &str, _timestamp: Option<OffsetDateTime>) -> anyhow::Result<Vec<PriceSnapshot>> {
        let event_prices = self.get_event_prices(event_fingerprint).await?;
        let mut snapshots = Vec::new();

        for event_price in event_prices {
            if let (Some(prices_json), Some(outcomes_json)) = (event_price.prices, event_price.outcomes) {
                let prices = self.parse_prices_from_json(&prices_json);
                let outcomes = self.parse_outcomes_from_json(&outcomes_json);
                
                let mut outcome_prices = Vec::new();
                for (index, (outcome, price)) in outcomes.iter().zip(prices.iter()).enumerate() {
                    outcome_prices.push(OutcomePrice {
                        outcome_name: outcome.clone(),
                        outcome_index: index as i32,
                        price: *price,
                        volume: None, // Could be extracted from event data
                    });
                }

                snapshots.push(PriceSnapshot {
                    timestamp: time::OffsetDateTime::parse(&event_price.observed_at, &time::format_description::well_known::Rfc3339)
                        .unwrap_or_else(|_| time::OffsetDateTime::now_utc()),
                    prices: outcome_prices,
                    volume: event_price.traded_amount,
                    source: event_price.source.parse().unwrap_or(PlatformSource::Polymarket),
                });
            }
        }

        Ok(snapshots)
    }

    /// Get price trends for an event over time
    pub async fn get_price_trends(&self, event_fingerprint: &str, _hours_back: i64) -> anyhow::Result<HashMap<String, Vec<(OffsetDateTime, f64)>>> {
        let event_prices = self.get_event_prices(event_fingerprint).await?;
        let mut trends: HashMap<String, Vec<(OffsetDateTime, f64)>> = HashMap::new();

        for event_price in event_prices {
            if let (Some(prices_json), Some(outcomes_json)) = (event_price.prices, event_price.outcomes) {
                let prices = self.parse_prices_from_json(&prices_json);
                let outcomes = self.parse_outcomes_from_json(&outcomes_json);
                
                for (outcome, price) in outcomes.iter().zip(prices.iter()) {
                    trends.entry(outcome.clone())
                        .or_insert_with(Vec::new)
                        .push((
                            time::OffsetDateTime::parse(&event_price.observed_at, &time::format_description::well_known::Rfc3339)
                                .unwrap_or_else(|_| time::OffsetDateTime::now_utc()),
                            *price
                        ));
                }
            }
        }

        // Sort by timestamp for each outcome
        for trend in trends.values_mut() {
            trend.sort_by(|a, b| a.0.cmp(&b.0));
        }

        Ok(trends)
    }

    /// Extract prices from event payload based on platform
    fn extract_prices_from_event(&self, event: &MarketEvent) -> Option<Value> {
        match event.source {
            PlatformSource::Polymarket => {
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
                                return Some(Value::Array(
                                    prices.into_iter().map(|p| Value::Number(
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
                                return Some(Value::Array(
                                    prices.into_iter().map(|p| Value::Number(
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
                                return Some(Value::Array(
                                    prices.into_iter().map(|p| Value::Number(
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
                                return Some(Value::Array(
                                    prices.into_iter().map(|p| Value::Number(
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

    /// Extract outcomes from event payload based on platform
    fn extract_outcomes_from_event(&self, event: &MarketEvent) -> Option<Value> {
        match event.source {
            PlatformSource::Polymarket => {
                event.payload.get("outcomes")
                    .or_else(|| event.payload.get("outcome_tokens"))
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
                                return Value::Array(
                                    outcome_names.into_iter().map(|name| Value::String(name)).collect()
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
                                return Value::Array(
                                    outcome_names.into_iter().map(|name| Value::String(name)).collect()
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
                                return Value::Array(
                                    outcome_names.into_iter().map(|name| Value::String(name)).collect()
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
                                return Value::Array(
                                    outcome_names.into_iter().map(|name| Value::String(name)).collect()
                                );
                            }
                        }
                        outcomes.clone()
                    })
            },
        }
    }

    /// Parse prices from JSON value
    fn parse_prices_from_json(&self, prices_json: &Value) -> Vec<f64> {
        if let Some(prices_array) = prices_json.as_array() {
            prices_array.iter()
                .filter_map(|p| p.as_f64())
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Parse outcomes from JSON value
    fn parse_outcomes_from_json(&self, outcomes_json: &Value) -> Vec<String> {
        if let Some(outcomes_array) = outcomes_json.as_array() {
            outcomes_array.iter()
                .filter_map(|o| o.as_str())
                .map(|s| s.to_string())
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Get market source ID for an event
    async fn get_market_source_id(&self, event: &MarketEvent) -> anyhow::Result<Option<Uuid>> {
        self.postgres.get_market_source_id(event).await
    }
}
