use crate::clients::postgres::PostgresClient;
use crate::wallet_sources::{WalletSource, WalletTrade};
use anyhow::Context;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

#[derive(Clone)]
pub struct WalletTracker {
    postgres: PostgresClient,
    tracked_wallets: Arc<RwLock<HashMap<String, Uuid>>>, // wallet_address -> wallet_id
}

impl WalletTracker {
    pub fn new(postgres: PostgresClient) -> Self {
        Self {
            postgres,
            tracked_wallets: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Initialize wallet tracker by loading tracked wallets from database
    pub async fn initialize(&self) -> anyhow::Result<()> {
        tracing::info!("Initializing wallet tracker...");
        
        let wallets = self.postgres.get_tracked_wallets().await?;
        
        let mut tracked = self.tracked_wallets.write().await;
        for wallet in wallets {
            tracked.insert(wallet.wallet_address.clone(), wallet.id);
            tracing::info!(
                wallet_address = %wallet.wallet_address,
                platform = %wallet.platform,
                "Loaded tracked wallet"
            );
        }
        
        tracing::info!(count = tracked.len(), "Wallet tracker initialized");
        Ok(())
    }

    /// Add a new wallet to track
    pub async fn add_wallet(&self, wallet_address: String, platform: String, nickname: Option<String>) -> anyhow::Result<Uuid> {
        let wallet_id = self.postgres.add_tracked_wallet(&wallet_address, &platform, nickname.as_deref()).await?;
        
        let mut tracked = self.tracked_wallets.write().await;
        tracked.insert(wallet_address.clone(), wallet_id);
        
        tracing::info!(
            wallet_address = %wallet_address,
            platform = %platform,
            "Added new tracked wallet"
        );
        
        Ok(wallet_id)
    }

    /// Start tracking wallets from all sources
    pub async fn start_tracking(&self, sources: Vec<Box<dyn WalletSource>>) -> anyhow::Result<()> {
        let (tx, mut rx) = mpsc::channel::<WalletTrade>(1024);
        
        // Spawn each wallet source as a background task
        for source in sources {
            let tx_clone = tx.clone();
            let tracked = self.tracked_wallets.read().await;
            let wallets: Vec<String> = tracked.keys().cloned().collect();
            
            tokio::spawn(async move {
                if let Err(e) = source.track_wallets(wallets, tx_clone).await {
                    tracing::error!(
                        source = source.platform(),
                        error = %e,
                        "Wallet source tracking failed"
                    );
                }
            });
        }
        
        drop(tx);
        
        // Process incoming trades
        while let Some(trade) = rx.recv().await {
            if let Err(e) = self.process_trade(trade).await {
                tracing::error!(error = %e, "Failed to process wallet trade");
            }
        }
        
        Ok(())
    }

    /// Process a wallet trade
    async fn process_trade(&self, trade: WalletTrade) -> anyhow::Result<()> {
        // Get wallet_id from address
        let tracked = self.tracked_wallets.read().await;
        let wallet_id = tracked.get(&trade.wallet_address)
            .context("Wallet not found in tracked list")?;
        let wallet_id = *wallet_id;
        drop(tracked);
        
        // Store the trade
        self.postgres.store_wallet_trade(wallet_id, &trade).await?;
        
        tracing::info!(
            wallet_address = %trade.wallet_address,
            platform = %trade.platform,
            market_id = %trade.market_id,
            side = %trade.side,
            amount = %trade.amount,
            "Stored wallet trade"
        );
        
        Ok(())
    }

    /// Update wallet statistics for all tracked wallets
    pub async fn update_all_stats(&self) -> anyhow::Result<()> {
        tracing::info!("Updating wallet statistics...");
        
        let tracked = self.tracked_wallets.read().await;
        let wallets: Vec<(String, Uuid)> = tracked.iter().map(|(k, v)| (k.clone(), *v)).collect();
        drop(tracked);
        
        for (wallet_address, wallet_id) in wallets {
            if let Err(e) = self.update_wallet_stats(wallet_id).await {
                tracing::error!(
                    wallet_address = %wallet_address,
                    error = %e,
                    "Failed to update wallet stats"
                );
            }
        }
        
        tracing::info!("Wallet statistics updated");
        Ok(())
    }

    /// Update statistics for a specific wallet
    async fn update_wallet_stats(&self, wallet_id: Uuid) -> anyhow::Result<()> {
        self.postgres.calculate_wallet_stats(wallet_id).await?;
        Ok(())
    }

    /// Start periodic stats update
    pub async fn start_periodic_stats_update(&self, interval_seconds: u64) {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(interval_seconds));
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.update_all_stats().await {
                tracing::error!(error = %e, "Periodic stats update failed");
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct TrackedWallet {
    pub id: Uuid,
    pub wallet_address: String,
    pub platform: String,
    pub nickname: Option<String>,
    pub is_active: bool,
}

