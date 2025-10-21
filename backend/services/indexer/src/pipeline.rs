use crate::config::AppConfig;
use crate::fingerprint::EventFingerprinter;
use crate::model::MarketEvent;
use crate::clients::postgres::PostgresClient;
use crate::sources::{augur::AugurSource, kalshi::KalshiSource, polymarket::PolymarketSource, thales::ThalesSource, omen::OmenSource, Source};

pub struct IndexerPipeline {
    cfg: AppConfig,
    postgres: PostgresClient,
}

impl IndexerPipeline {
    pub async fn new(cfg: AppConfig) -> anyhow::Result<Self> {
        let postgres = PostgresClient::new(&cfg.postgres_url).await?;
        postgres.ensure_schema().await?;
        
        Ok(Self { 
            cfg,
            postgres,
        })
    }

    pub async fn run_all(&mut self) -> anyhow::Result<()> {
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
                tracing::debug!(
                    source = %evt.source,
                    market_id = %evt.market_id,
                    fingerprint = ?evt.event_fingerprint,
                    "successfully processed event"
                );
            }
        }

        Ok(())
    }
}


