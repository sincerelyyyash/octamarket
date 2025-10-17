use crate::config::AppConfig;
use crate::fingerprint::EventFingerprinter;
use crate::model::MarketEvent;
use crate::normalizer::normalize;
use crate::clients::{kafka::KafkaClient, postgres::PostgresClient, redis::RedisClient};
use crate::sources::{augur::AugurSource, kalshi::KalshiSource, polymarket::PolymarketSource, thales::ThalesSource, omen::OmenSource, Source};

pub struct IndexerPipeline {
    cfg: AppConfig,
}

impl IndexerPipeline {
    pub async fn new(cfg: AppConfig) -> anyhow::Result<Self> {
        // Build clients and ensure schema; keep them in tasks as needed later
        let pg = PostgresClient::new(&cfg.postgres_url).await?;
        pg.ensure_schema().await?;
        let _kafka = KafkaClient::new(&cfg.kafka_brokers)?;
        let _redis = RedisClient::new(&cfg.redis_url).await?;
        Ok(Self { cfg })
    }

    pub async fn run_all(&self) -> anyhow::Result<()> {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<MarketEvent>(1024);

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

        let kafka = KafkaClient::new(&self.cfg.kafka_brokers)?;
        let mut redis = RedisClient::new(&self.cfg.redis_url).await?;
        let mut fingerprinter = EventFingerprinter::new();

        while let Some(mut evt) = rx.recv().await {
            // Generate fingerprint for event grouping
            if let Some(fingerprint) = fingerprinter.fingerprint(&evt) {
                evt = evt.with_fingerprint(fingerprint);
            }
            // fanout to raw
            let key = &evt.market_id;
            let raw = serde_json::to_string(&evt)?;
            kafka.send(&kafka.topic_raw, key, &raw).await.ok();

            // normalize and fanout
            let norm = normalize(&evt);
            let norm_json = serde_json::to_string(&norm)?;
            kafka.send(&kafka.topic_normalized, key, &norm_json).await.ok();

            // simple heuristic: trades and orderbook -> realtime topic
            if matches!(evt.kind, crate::model::MarketEventKind::Trade | crate::model::MarketEventKind::OrderBook) {
                kafka.send(&kafka.topic_realtime, key, &raw).await.ok();
            }

            // cache latest normalized state per market
            let cache_key = format!("market:{}:latest", key);
            let _ = redis.set_json(&cache_key, &serde_json::to_value(&norm)?).await;
        }

        Ok(())
    }
}


