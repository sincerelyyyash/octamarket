use crate::aggregator::price_aggregator::{PriceAggregator, PriceData};
use crate::errors::ApiError;
use crate::models::{ArbitrageOpportunity, TradeSide};

/// Detects arbitrage opportunities across platforms
pub struct ArbitrageDetector {
    aggregator: PriceAggregator,
    min_profit_pct: f64,
}

impl ArbitrageDetector {
    pub fn new(aggregator: PriceAggregator, min_profit_pct: f64) -> Self {
        Self {
            aggregator,
            min_profit_pct,
        }
    }

    /// Detect arbitrage opportunities for a specific event
    pub async fn detect_for_event(
        &self,
        event_fingerprint: &str,
        event_title: &str,
    ) -> Result<Vec<ArbitrageOpportunity>, ApiError> {
        let prices = self.aggregator.get_prices_for_event(event_fingerprint).await?;
        
        let mut opportunities = Vec::new();
        
        // For binary markets, check if we can buy Yes on one platform and No on another
        // such that the combined cost is less than 1 (guaranteed profit)
        let yes_prices: Vec<&PriceData> = prices.iter()
            .filter(|p| is_yes_outcome(&p.outcome))
            .collect();
        
        let no_prices: Vec<&PriceData> = prices.iter()
            .filter(|p| !is_yes_outcome(&p.outcome))
            .collect();
        
        // Find cross-platform arbitrage
        for yes_price in &yes_prices {
            for no_price in &no_prices {
                // Skip if same platform
                if yes_price.platform == no_price.platform {
                    continue;
                }
                
                let total_cost = yes_price.price + no_price.price;
                
                // Arbitrage exists if total cost < 1 (assuming both outcomes pay out 1)
                if total_cost < 1.0 {
                    let profit = 1.0 - total_cost;
                    let profit_pct = (profit / total_cost) * 100.0;
                    
                    if profit_pct >= self.min_profit_pct {
                        opportunities.push(ArbitrageOpportunity {
                            event_fingerprint: event_fingerprint.to_string(),
                            event_title: event_title.to_string(),
                            profit_pct,
                            buy_side: TradeSide {
                                platform: yes_price.platform.clone(),
                                market_id: yes_price.market_id.clone(),
                                outcome: yes_price.outcome.clone(),
                                price: yes_price.price,
                            },
                            sell_side: TradeSide {
                                platform: no_price.platform.clone(),
                                market_id: no_price.market_id.clone(),
                                outcome: no_price.outcome.clone(),
                                price: no_price.price,
                            },
                        });
                    }
                }
            }
        }
        
        // Also check same-platform arbitrage (less common but possible)
        opportunities.extend(self.detect_same_platform_arbitrage(&prices, event_fingerprint, event_title)?);
        
        Ok(opportunities)
    }

    /// Detect arbitrage on the same platform
    fn detect_same_platform_arbitrage(
        &self,
        prices: &[PriceData],
        event_fingerprint: &str,
        event_title: &str,
    ) -> Result<Vec<ArbitrageOpportunity>, ApiError> {
        let mut opportunities = Vec::new();
        
        // Group by platform
        let mut platform_prices: std::collections::HashMap<String, Vec<&PriceData>> = std::collections::HashMap::new();
        
        for price in prices {
            platform_prices
                .entry(price.platform.clone())
                .or_insert_with(Vec::new)
                .push(price);
        }
        
        // For each platform, check if sum of all outcome prices != 1
        for (platform, platform_price_list) in platform_prices {
            if platform_price_list.len() < 2 {
                continue;
            }
            
            let total_price: f64 = platform_price_list.iter().map(|p| p.price).sum();
            
            if total_price < 1.0 {
                let profit = 1.0 - total_price;
                let profit_pct = (profit / total_price) * 100.0;
                
                if profit_pct >= self.min_profit_pct && platform_price_list.len() == 2 {
                    opportunities.push(ArbitrageOpportunity {
                        event_fingerprint: event_fingerprint.to_string(),
                        event_title: event_title.to_string(),
                        profit_pct,
                        buy_side: TradeSide {
                            platform: platform.clone(),
                            market_id: platform_price_list[0].market_id.clone(),
                            outcome: platform_price_list[0].outcome.clone(),
                            price: platform_price_list[0].price,
                        },
                        sell_side: TradeSide {
                            platform: platform.clone(),
                            market_id: platform_price_list[1].market_id.clone(),
                            outcome: platform_price_list[1].outcome.clone(),
                            price: platform_price_list[1].price,
                        },
                    });
                }
            }
        }
        
        Ok(opportunities)
    }

    /// Scan all markets for arbitrage opportunities
    pub async fn scan_all_markets(&self) -> Result<Vec<ArbitrageOpportunity>, ApiError> {
        let markets = self.aggregator.get_all_markets(Some(100)).await?;
        
        let mut all_opportunities = Vec::new();
        
        for market in markets {
            match self.detect_for_event(&market.event_fingerprint, &market.title).await {
                Ok(opportunities) => {
                    all_opportunities.extend(opportunities);
                }
                Err(e) => {
                    tracing::warn!(
                        event_fingerprint = %market.event_fingerprint,
                        error = %e,
                        "Failed to detect arbitrage for market"
                    );
                }
            }
        }
        
        Ok(all_opportunities)
    }
}

fn is_yes_outcome(outcome: &str) -> bool {
    let outcome_lower = outcome.to_lowercase();
    outcome_lower == "yes" || outcome_lower == "true" || outcome_lower.contains("yes")
}


