use crate::models::ArbitrageOpportunity;

/// Analyzes arbitrage opportunities for risk and profitability
pub struct ArbitrageAnalyzer;

impl ArbitrageAnalyzer {
    pub fn new() -> Self {
        Self
    }

    /// Calculate minimum capital required for an arbitrage opportunity
    pub fn calculate_min_capital(&self, opportunity: &ArbitrageOpportunity, target_profit_usd: f64) -> f64 {
        // Capital needed = target_profit / profit_pct
        let profit_decimal = opportunity.profit_pct / 100.0;
        target_profit_usd / profit_decimal
    }

    /// Calculate expected profit in USD for a given capital
    pub fn calculate_profit(&self, opportunity: &ArbitrageOpportunity, capital_usd: f64) -> f64 {
        let profit_decimal = opportunity.profit_pct / 100.0;
        capital_usd * profit_decimal
    }

    /// Analyze risk factors for an arbitrage opportunity
    pub fn analyze_risk(&self, opportunity: &ArbitrageOpportunity) -> RiskAnalysis {
        let mut risk_factors = Vec::new();
        let mut risk_score = 0.0; // 0-100, lower is better
        
        // Cross-platform risk
        if opportunity.buy_side.platform != opportunity.sell_side.platform {
            risk_factors.push("Cross-platform execution risk".to_string());
            risk_score += 20.0;
        }
        
        // Low profit margin risk
        if opportunity.profit_pct < 1.0 {
            risk_factors.push("Low profit margin".to_string());
            risk_score += 15.0;
        }
        
        // Price volatility risk (if prices are very close to each other)
        let price_diff = (opportunity.buy_side.price - opportunity.sell_side.price).abs();
        if price_diff < 0.05 {
            risk_factors.push("High price volatility risk".to_string());
            risk_score += 25.0;
        }
        
        // Execution time risk
        risk_factors.push("Time lag between executions".to_string());
        risk_score += 10.0;
        
        let risk_level = if risk_score < 30.0 {
            "Low"
        } else if risk_score < 60.0 {
            "Medium"
        } else {
            "High"
        };
        
        RiskAnalysis {
            risk_score,
            risk_level: risk_level.to_string(),
            risk_factors,
        }
    }

    /// Filter opportunities by minimum profit and maximum risk
    pub fn filter_opportunities(
        &self,
        opportunities: Vec<ArbitrageOpportunity>,
        min_profit_pct: f64,
        max_risk_score: f64,
    ) -> Vec<(ArbitrageOpportunity, RiskAnalysis)> {
        opportunities
            .into_iter()
            .filter(|opp| opp.profit_pct >= min_profit_pct)
            .map(|opp| {
                let risk = self.analyze_risk(&opp);
                (opp, risk)
            })
            .filter(|(_, risk)| risk.risk_score <= max_risk_score)
            .collect()
    }
}

impl Default for ArbitrageAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct RiskAnalysis {
    pub risk_score: f64,
    pub risk_level: String,
    pub risk_factors: Vec<String>,
}


