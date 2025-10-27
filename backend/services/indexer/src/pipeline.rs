use crate::config::AppConfig;
use crate::fingerprint::EventFingerprinter;
use crate::model::MarketEvent;
use crate::clients::postgres::PostgresClient;
use crate::sources::{augur::AugurSource, kalshi::KalshiSource, polymarket::PolymarketSource, thales::ThalesSource, omen::OmenSource, Source};
use crate::price_indexer::PriceIndexer;
use crate::price_fetcher::PriceFetcher;
use crate::health::HealthMonitor;
use crate::wallet_tracker::WalletTracker;
use crate::wallet_sources::{polymarket::PolymarketWalletSource, WalletSource};

pub struct IndexerPipeline {
    cfg: AppConfig,
    postgres: PostgresClient,
    price_indexer: PriceIndexer,
    price_fetcher: PriceFetcher,
    health_monitor: HealthMonitor,
    wallet_tracker: Option<WalletTracker>,
}

impl IndexerPipeline {
    pub async fn new(cfg: AppConfig) -> anyhow::Result<Self> {
        let postgres = PostgresClient::new(&cfg.postgres_url).await?;
        postgres.ensure_schema().await?;
        let price_indexer = PriceIndexer::new(PostgresClient::new(&cfg.postgres_url).await?);
        let price_fetcher = PriceFetcher::new(PostgresClient::new(&cfg.postgres_url).await?);
        let health_monitor = HealthMonitor::new();
        
        // Initialize wallet tracker if enabled
        let wallet_tracker = if cfg.enable_wallet_tracking.unwrap_or(false) {
            let mut tracker = WalletTracker::new(PostgresClient::new(&cfg.postgres_url).await?);
            tracker.initialize().await?;
            Some(tracker)
        } else {
            None
        };
        
        Ok(Self { 
            cfg,
            postgres,
            price_indexer,
            price_fetcher,
            health_monitor,
            wallet_tracker,
        })
    }

    pub async fn run_all(&mut self) -> anyhow::Result<()> {
        // Start periodic price fetching as a background task
        let price_fetcher = self.price_fetcher.clone();
        let fetch_interval = self.cfg.price_fetch_interval_seconds.unwrap_or(60);
        tokio::spawn(async move {
            if let Err(e) = price_fetcher.start_periodic_fetching(fetch_interval).await {
                tracing::error!(error = %e, "Periodic price fetching failed");
            }
        });

        // Start wallet tracking if enabled
        if let Some(ref wallet_tracker) = self.wallet_tracker {
            tracing::info!("Wallet tracking is enabled");
            
            // Start wallet tracking in background
            let wallet_tracker_clone = wallet_tracker.clone();
            tokio::spawn(async move {
                let sources: Vec<Box<dyn WalletSource>> = vec![
                    Box::new(PolymarketWalletSource::new()),
                ];
                
                if let Err(e) = wallet_tracker_clone.start_tracking(sources).await {
                    tracing::error!(error = %e, "Wallet tracking failed");
                }
            });
            
            // Start periodic stats updates
            let wallet_tracker_clone = wallet_tracker.clone();
            let stats_interval = self.cfg.wallet_stats_update_interval_seconds.unwrap_or(300);
            tokio::spawn(async move {
                wallet_tracker_clone.start_periodic_stats_update(stats_interval).await;
            });
        }

        let (tx, mut rx) = tokio::sync::mpsc::channel::<MarketEvent>(1024);
        let mut backpressure_count = 0;

        let sources: Vec<Box<dyn Source>> = vec![
            Box::new(PolymarketSource::new()),
            Box::new(AugurSource::new()),
            Box::new(KalshiSource::new(self.cfg.kalshi_api_key.clone(), self.cfg.kalshi_api_secret.clone())),
            Box::new(ThalesSource::new()),
            Box::new(OmenSource::new()),
        ];

        for src in sources.into_iter() {
            let tx_src = tx.clone();
            tokio::spawn(async move {
                if let Err(err) = src.run(tx_src).await {
                    tracing::error!(error = %err, source = src.name(), "source task failed");
                }
            });
        }
        drop(tx);

        let mut fingerprinter = EventFingerprinter::new();

        while let Some(mut evt) = rx.recv().await {
            println!("📥 EVENT RECEIVED:");
            println!("  Source: {:?}", evt.source);
            println!("  Market ID: {}", evt.market_id);
            println!("  Kind: {:?}", evt.kind);
            println!("  Payload keys: {:?}", evt.payload.as_object().map(|o| o.keys().collect::<Vec<_>>()));
            
            // Check for backpressure - if channel is getting full, slow down processing
            if rx.len() > 800 {
                backpressure_count += 1;
                if backpressure_count % 100 == 0 {
                    tracing::warn!("backpressure detected: {} events queued, processing may be slow", rx.len());
                }
                // Small delay to let the channel drain
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            } else {
                backpressure_count = 0;
            }

            // Generate fingerprint for event grouping
            if let Some(fingerprint) = fingerprinter.fingerprint(&evt) {
                evt = evt.with_fingerprint(fingerprint);
            }
            
            // Validate event data
            if evt.market_id.is_empty() || evt.payload.is_null() {
                tracing::warn!("skipping invalid event: empty market_id or null payload");
                continue;
            }

            // Store or update event in PostgreSQL with aggregation logic
            if let Err(e) = self.postgres.store_or_update_event(&evt).await {
                tracing::error!(error = %e, "failed to store event to database");
            } else {
                // Index prices for the event
                if let Err(e) = self.price_indexer.index_prices_from_event(&evt).await {
                    tracing::warn!(error = %e, "failed to index prices for event");
                }
                
                tracing::debug!(
                    source = %evt.source,
                    market_id = %evt.market_id,
                    fingerprint = ?evt.event_fingerprint,
                    "successfully processed event and indexed prices"
                );
            }
        }

        Ok(())
    }

    /// Get the current health status of the pipeline
    pub async fn get_health_status(&self) -> crate::health::HealthStatus {
        self.health_monitor.get_health_status().await
    }

    /// Start health monitoring
    pub async fn start_health_monitoring(&self) {
        self.health_monitor.start_monitoring().await;
    }
}


