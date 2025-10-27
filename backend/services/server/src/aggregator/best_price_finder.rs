use crate::aggregator::price_aggregator::{PriceAggregator, PriceData};
use crate::errors::ApiError;
use crate::models::BestPrice;
use chrono::Utc;

/// Find best prices across all platforms for binary markets
pub struct BestPriceFinder {
    aggregator: PriceAggregator,
}

impl BestPriceFinder {
    pub fn new(aggregator: PriceAggregator) -> Self {
        Self { aggregator }
    }

    /// Find best prices for a specific event
    /// For binary markets: find best price for Yes and No outcomes
    pub async fn find_best_prices(&self, event_fingerprint: &str, event_title: &str) -> Result<BestPrice, ApiError> {
        let prices = self.aggregator.get_prices_for_event(event_fingerprint).await?;
        
        let mut best_yes: Option<PriceData> = None;
        let mut best_no: Option<PriceData> = None;
        
        for price in prices {
            let is_yes = price.outcome.to_lowercase().contains("yes") || 
                         price.outcome.to_lowercase() == "true" ||
                         price.outcome_index == 0;
            
            if is_yes {
                // For buying Yes, we want the lowest price
                if best_yes.is_none() || price.price < best_yes.as_ref().unwrap().price {
                    best_yes = Some(price);
                }
            } else {
                // For buying No, we want the lowest price
                if best_no.is_none() || price.price < best_no.as_ref().unwrap().price {
                    best_no = Some(price);
                }
            }
        }
        
        Ok(BestPrice {
            event_fingerprint: event_fingerprint.to_string(),
            event_title: event_title.to_string(),
            best_yes_price: best_yes.as_ref().map(|p| p.price),
            best_yes_platform: best_yes.as_ref().map(|p| p.platform.clone()),
            best_yes_market_id: best_yes.map(|p| p.market_id),
            best_no_price: best_no.as_ref().map(|p| p.price),
            best_no_platform: best_no.as_ref().map(|p| p.platform.clone()),
            best_no_market_id: best_no.map(|p| p.market_id),
            last_updated: Utc::now(),
        })
    }

    /// Find best prices for all active markets
    pub async fn find_all_best_prices(&self) -> Result<Vec<BestPrice>, ApiError> {
        let markets = self.aggregator.get_all_markets(Some(100)).await?;
        
        let mut best_prices = Vec::new();
        
        for market in markets {
            match self.find_best_prices(&market.event_fingerprint, &market.title).await {
                Ok(best_price) => best_prices.push(best_price),
                Err(e) => {
                    tracing::warn!(
                        event_fingerprint = %market.event_fingerprint,
                        error = %e,
                        "Failed to find best prices for market"
                    );
                }
            }
        }
        
        Ok(best_prices)
    }
}


