use crate::db::DualDatabase;
use crate::errors::ApiError;
use crate::models::{MarketSourceView, AggregatedMarketView};

/// Price aggregator that queries the indexer database for market data
pub struct PriceAggregator {
    db: DualDatabase,
}

impl PriceAggregator {
    pub fn new(db: DualDatabase) -> Self {
        Self { db }
    }

    /// Get all active markets from indexer
    pub async fn get_all_markets(&self, limit: Option<i64>) -> Result<Vec<AggregatedMarketView>, ApiError> {
        self.db.get_aggregated_markets(limit).await
    }

    /// Get market sources for a specific event
    pub async fn get_market_sources(&self, event_fingerprint: &str) -> Result<Vec<MarketSourceView>, ApiError> {
        self.db.get_market_sources_for_event(event_fingerprint).await
    }

    /// Get all prices for a specific market across all platforms
    pub async fn get_prices_for_event(&self, event_fingerprint: &str) -> Result<Vec<PriceData>, ApiError> {
        let sources = self.get_market_sources(event_fingerprint).await?;
        
        let mut prices = Vec::new();
        
        for source in sources {
            if let (Some(outcomes), Some(price_data)) = (source.outcomes, source.prices) {
                // Parse outcomes and prices
                if let (Some(outcomes_arr), Some(prices_arr)) = (outcomes.as_array(), price_data.as_array()) {
                    for (idx, outcome) in outcomes_arr.iter().enumerate() {
                        if let Some(outcome_str) = outcome.as_str() {
                            if let Some(price_val) = prices_arr.get(idx).and_then(|p| p.as_f64()) {
                                prices.push(PriceData {
                                    platform: source.source.clone(),
                                    market_id: source.market_id.clone(),
                                    outcome: outcome_str.to_string(),
                                    outcome_index: idx as i32,
                                    price: price_val,
                                    volume: source.traded_amount,
                                    observed_at: source.observed_at.clone(),
                                });
                            }
                        }
                    }
                }
            }
        }
        
        Ok(prices)
    }
}

#[derive(Debug, Clone)]
pub struct PriceData {
    pub platform: String,
    pub market_id: String,
    pub outcome: String,
    pub outcome_index: i32,
    pub price: f64,
    pub volume: Option<f64>,
    pub observed_at: String,
}


