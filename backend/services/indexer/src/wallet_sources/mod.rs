pub mod polymarket;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use tokio::sync::mpsc;

#[async_trait]
pub trait WalletSource: Send + Sync {
    /// Platform name (e.g., "polymarket", "augur")
    fn platform(&self) -> &'static str;
    
    /// Start tracking wallet addresses and send trades through channel
    async fn track_wallets(
        &self,
        wallet_addresses: Vec<String>,
        tx: mpsc::Sender<WalletTrade>,
    ) -> anyhow::Result<()>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletTrade {
    pub wallet_address: String,
    pub platform: String,
    pub market_id: String,
    pub side: String, // "buy" or "sell"
    pub outcome_index: Option<i32>,
    pub outcome_name: Option<String>,
    pub price: f64,
    pub amount: f64,
    pub tx_hash: Option<String>,
    pub timestamp: OffsetDateTime,
    pub raw_data: serde_json::Value,
}

impl WalletTrade {
    pub fn new(
        wallet_address: String,
        platform: String,
        market_id: String,
        side: String,
        price: f64,
        amount: f64,
        timestamp: OffsetDateTime,
    ) -> Self {
        Self {
            wallet_address,
            platform,
            market_id,
            side,
            outcome_index: None,
            outcome_name: None,
            price,
            amount,
            tx_hash: None,
            timestamp,
            raw_data: serde_json::Value::Null,
        }
    }

    pub fn with_outcome(mut self, index: i32, name: String) -> Self {
        self.outcome_index = Some(index);
        self.outcome_name = Some(name);
        self
    }

    pub fn with_tx_hash(mut self, tx_hash: String) -> Self {
        self.tx_hash = Some(tx_hash);
        self
    }

    pub fn with_raw_data(mut self, raw_data: serde_json::Value) -> Self {
        self.raw_data = raw_data;
        self
    }
}


