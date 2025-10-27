use super::{WalletSource, WalletTrade};
use async_trait::async_trait;
use reqwest::Client;
use time::OffsetDateTime;
use tokio::sync::mpsc;

pub struct PolymarketWalletSource {
    client: Client,
}

impl PolymarketWalletSource {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Fetch trades for a specific wallet from Polymarket API
    async fn fetch_wallet_trades(&self, wallet_address: &str) -> anyhow::Result<Vec<WalletTrade>> {
        // Polymarket CLOB API endpoint for user trades
        let url = format!(
            "https://clob.polymarket.com/trades?maker={}&limit=100",
            wallet_address
        );
        
        let response = self.client
            .get(&url)
            .send()
            .await?;
        
        if !response.status().is_success() {
            tracing::warn!(
                wallet = %wallet_address,
                status = %response.status(),
                "Failed to fetch Polymarket trades"
            );
            return Ok(Vec::new());
        }
        
        let data: serde_json::Value = response.json().await?;
        
        let mut trades = Vec::new();
        
        if let Some(trades_array) = data.as_array() {
            for trade_data in trades_array {
                if let Some(trade) = self.parse_trade(wallet_address, trade_data) {
                    trades.push(trade);
                }
            }
        }
        
        Ok(trades)
    }

    /// Parse Polymarket trade data into WalletTrade
    fn parse_trade(&self, wallet_address: &str, data: &serde_json::Value) -> Option<WalletTrade> {
        let market_id = data.get("asset_id")?.as_str()?.to_string();
        let side = data.get("side")?.as_str()?.to_string();
        let price = data.get("price")?.as_str()?.parse::<f64>().ok()?;
        let size = data.get("size")?.as_str()?.parse::<f64>().ok()?;
        let amount = price * size;
        
        // Parse timestamp
        let timestamp_ms = data.get("timestamp")?.as_i64()?;
        let timestamp = OffsetDateTime::from_unix_timestamp(timestamp_ms / 1000).ok()?;
        
        let mut trade = WalletTrade::new(
            wallet_address.to_string(),
            "polymarket".to_string(),
            market_id,
            side,
            price,
            amount,
            timestamp,
        );
        
        // Add outcome info if available
        if let Some(outcome) = data.get("outcome").and_then(|o| o.as_str()) {
            let outcome_index = if outcome == "Yes" || outcome == "YES" { 0 } else { 1 };
            trade = trade.with_outcome(outcome_index, outcome.to_string());
        }
        
        // Add transaction hash if available
        if let Some(tx_hash) = data.get("transaction_hash").and_then(|h| h.as_str()) {
            trade = trade.with_tx_hash(tx_hash.to_string());
        }
        
        trade = trade.with_raw_data(data.clone());
        
        Some(trade)
    }
}

#[async_trait]
impl WalletSource for PolymarketWalletSource {
    fn platform(&self) -> &'static str {
        "polymarket"
    }

    async fn track_wallets(
        &self,
        wallet_addresses: Vec<String>,
        tx: mpsc::Sender<WalletTrade>,
    ) -> anyhow::Result<()> {
        tracing::info!(
            count = wallet_addresses.len(),
            "Starting Polymarket wallet tracking"
        );
        
        // Track each wallet in a loop with polling interval
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        let mut last_seen_trades: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        
        loop {
            interval.tick().await;
            
            for wallet_address in &wallet_addresses {
                match self.fetch_wallet_trades(wallet_address).await {
                    Ok(trades) => {
                        for trade in trades {
                            // Simple deduplication based on tx_hash or timestamp+market
                            let trade_key = if let Some(ref tx_hash) = trade.tx_hash {
                                tx_hash.clone()
                            } else {
                                format!("{}:{}:{}", trade.timestamp, trade.market_id, trade.amount)
                            };
                            
                            // Check if we've already seen this trade
                            if let Some(last_key) = last_seen_trades.get(wallet_address) {
                                if last_key == &trade_key {
                                    // Skip trades we've already processed
                                    continue;
                                }
                            }
                            
                            // Update last seen
                            last_seen_trades.insert(wallet_address.clone(), trade_key);
                            
                            // Send trade through channel
                            if let Err(e) = tx.send(trade).await {
                                tracing::error!(
                                    error = %e,
                                    wallet = %wallet_address,
                                    "Failed to send wallet trade"
                                );
                                return Err(anyhow::anyhow!("Channel closed"));
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            error = %e,
                            wallet = %wallet_address,
                            "Failed to fetch Polymarket trades"
                        );
                    }
                }
            }
        }
    }
}

impl Default for PolymarketWalletSource {
    fn default() -> Self {
        Self::new()
    }
}


