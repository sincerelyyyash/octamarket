use crate::model::{MarketEvent, MarketEventKind, PlatformSource};
use crate::clients::postgres::PostgresClient;
use crate::price_indexer::PriceIndexer;
use crate::rate_limiter::RateLimiter;
use crate::retry::{with_retry_async, RetryConfig};
use crate::health::HealthMonitor;
use time::OffsetDateTime;
use uuid::Uuid;
use serde_json::Value;
use tokio::time::Duration;
use tracing::{info, warn, error};

#[derive(Clone)]
pub struct PriceFetcher {
    postgres: PostgresClient,
    price_indexer: PriceIndexer,
    http_client: reqwest::Client,
    rate_limiter: RateLimiter,
    health_monitor: HealthMonitor,
}

impl PriceFetcher {
    pub fn new(postgres: PostgresClient) -> Self {
        let price_indexer = PriceIndexer::new(postgres.clone());
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
        
        let rate_limiter = RateLimiter::new(100, Duration::from_secs(60)); // 100 requests per minute
        let health_monitor = HealthMonitor::new();
        
        Self {
            postgres,
            price_indexer,
            http_client,
            rate_limiter,
            health_monitor,
        }
    }

    /// Start periodic price fetching for all open events
    pub async fn start_periodic_fetching(&self, interval_seconds: u64) -> anyhow::Result<()> {
        let mut interval = tokio::time::interval(Duration::from_secs(interval_seconds));
        
        info!("Starting periodic price fetching every {} seconds", interval_seconds);
        
        loop {
            interval.tick().await;
            
            let start_time = std::time::Instant::now();
            match self.fetch_all_open_event_prices().await {
                Ok(updated_count) => {
                    let duration = start_time.elapsed();
                    info!(
                        "Successfully updated prices for {} events in {:.2}s", 
                        updated_count, 
                        duration.as_secs_f64()
                    );
                }
                Err(e) => {
                    error!(error = %e, "Failed to fetch prices for open events");
                }
            }
        }
    }

    /// Fetch prices for all open events from all sources
    async fn fetch_all_open_event_prices(&self) -> anyhow::Result<usize> {
        // Get all open events from the database
        let open_events = self.get_open_events().await?;
        let mut updated_count = 0;
        let mut failed_count = 0;

        info!("Fetching prices for {} open events", open_events.len());

        // Process events in batches to avoid overwhelming the system
        const BATCH_SIZE: usize = 10;
        for chunk in open_events.chunks(BATCH_SIZE) {
            let mut batch_tasks = Vec::new();
            
            for event in chunk {
                let price_fetcher = self.clone();
                let event = event.clone();
                let task = tokio::spawn(async move {
                    price_fetcher.fetch_prices_for_event(&event).await
                });
                batch_tasks.push(task);
            }
            
            // Wait for all tasks in this batch to complete
            for task in batch_tasks {
                match task.await {
                    Ok(Ok(Some(market_events))) => {
                        for market_event in market_events {
                            if let Err(e) = self.price_indexer.index_prices_from_event(&market_event).await {
                                warn!(error = %e, "Failed to index prices for event");
                                failed_count += 1;
                            } else {
                                updated_count += 1;
                            }
                        }
                    }
                    Ok(Ok(None)) => {
                        // No price data available for this event
                        continue;
                    }
                    Ok(Err(e)) => {
                        warn!(error = %e, "Failed to fetch prices for event");
                        failed_count += 1;
                    }
                    Err(e) => {
                        warn!(error = %e, "Task failed to complete");
                        failed_count += 1;
                    }
                }
            }
            
            // Small delay between batches to avoid rate limiting
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }

        if failed_count > 0 {
            warn!("Failed to fetch prices for {} events", failed_count);
        }

        Ok(updated_count)
    }

    /// Manually trigger price fetching for a specific event
    pub async fn fetch_prices_for_specific_event(&self, event_fingerprint: &str) -> anyhow::Result<usize> {
        info!("Manually fetching prices for event: {}", event_fingerprint);
        self.fetch_prices_for_event_fingerprint(event_fingerprint).await
    }

    /// Get all open events from the database
    async fn get_open_events(&self) -> anyhow::Result<Vec<OpenEvent>> {
        let conn = self.postgres.pool.get().await?;
        
        let rows = conn.query(
            r#"
            SELECT 
                ae.id,
                ae.event_fingerprint,
                ae.title,
                ms.source,
                ms.market_id,
                ms.market_slug
            FROM aggregated_events ae
            JOIN market_sources ms ON ae.id = ms.aggregated_event_id
            WHERE ae.status = 'active'
            AND ae.end_time > NOW()
            GROUP BY ae.id, ae.event_fingerprint, ae.title, ms.source, ms.market_id, ms.market_slug
            ORDER BY ae.created_at DESC
            "#,
            &[]
        ).await?;

        let mut events = Vec::new();
        for row in rows {
            events.push(OpenEvent {
                id: row.get("id"),
                event_fingerprint: row.get("event_fingerprint"),
                title: row.get("title"),
                source: row.get("source"),
                market_id: row.get("market_id"),
                market_slug: row.get("market_slug"),
            });
        }

        Ok(events)
    }

    /// Fetch current prices for a specific event from its source
    async fn fetch_prices_for_event(&self, event: &OpenEvent) -> anyhow::Result<Option<Vec<MarketEvent>>> {
        let source = event.source.parse::<PlatformSource>()?;
        
        match source {
            PlatformSource::Polymarket => self.fetch_polymarket_prices(&event.market_id).await,
            PlatformSource::Augur => self.fetch_augur_prices(&event.market_id).await,
            PlatformSource::Kalshi => self.fetch_kalshi_prices(&event.market_id).await,
            PlatformSource::Thales => self.fetch_thales_prices(&event.market_id).await,
            PlatformSource::Omen => self.fetch_omen_prices(&event.market_id).await,
        }
    }

    /// Fetch current prices from Polymarket
    async fn fetch_polymarket_prices(&self, market_id: &str) -> anyhow::Result<Option<Vec<MarketEvent>>> {
        // Wait for rate limiter capacity
        self.rate_limiter.wait_for_capacity().await;
        
        let retry_config = RetryConfig {
            max_attempts: 3,
            base_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(10),
            backoff_multiplier: 2.0,
        };
        
        let result: anyhow::Result<Option<Vec<MarketEvent>>> = with_retry_async(
            || async {
                // Try multiple Polymarket endpoints for better coverage
                let endpoints = vec![
                    format!("https://gamma-api.polymarket.com/markets/{}", market_id),
                    format!("https://gamma-api.polymarket.com/events/{}", market_id),
                    format!("https://clob.polymarket.com/markets/{}", market_id),
                ];
                
                for url in endpoints {
                    match self.http_client.get(&url).send().await {
                        Ok(response) => {
                            if response.status().is_success() {
                                if let Ok(market_data) = response.json::<Value>().await {
                                    let event = MarketEvent::new(
                                        PlatformSource::Polymarket,
                                        MarketEventKind::MarketMetadata,
                                        market_id.to_string(),
                                        market_data,
                                        OffsetDateTime::now_utc(),
                                    );
                                    return Ok(Some(vec![event]));
                                }
                            }
                        }
                        Err(e) => {
                            warn!(error = %e, market_id = %market_id, url = %url, "Failed to fetch from Polymarket endpoint");
                        }
                    }
                }
                
                Ok(None)
            },
            retry_config,
            &format!("fetch_polymarket_prices_{}", market_id),
        ).await;
        
        match &result {
            Ok(Some(_)) => {
                self.health_monitor.update_source_status("polymarket", true, None).await;
                self.health_monitor.increment_price_updates().await;
            }
            Ok(None) => {
                self.health_monitor.update_source_status("polymarket", false, Some("No data available".to_string())).await;
            }
            Err(e) => {
                self.health_monitor.update_source_status("polymarket", false, Some(e.to_string())).await;
            }
        }
        
        result
    }

    /// Fetch current prices from Augur
    async fn fetch_augur_prices(&self, market_id: &str) -> anyhow::Result<Option<Vec<MarketEvent>>> {
        let query = serde_json::json!({
            "query": format!("{{ market(id: \"{}\") {{ id title endTime volume outcomes {{ price }} }} }}", market_id)
        });

        match self.http_client
            .post("https://api.thegraph.com/subgraphs/name/augurproject/augur-v2")
            .json(&query)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    if let Ok(data) = response.json::<Value>().await {
                        let event = MarketEvent::new(
                            PlatformSource::Augur,
                            MarketEventKind::MarketMetadata,
                            market_id.to_string(),
                            data,
                            OffsetDateTime::now_utc(),
                        );
                        return Ok(Some(vec![event]));
                    }
                }
            }
            Err(e) => {
                warn!(error = %e, market_id = %market_id, "Failed to fetch Augur prices");
            }
        }
        
        Ok(None)
    }

    /// Fetch current prices from Kalshi
    async fn fetch_kalshi_prices(&self, market_id: &str) -> anyhow::Result<Option<Vec<MarketEvent>>> {
        let url = format!("https://api.kalshi.com/markets/{}", market_id);
        
        match self.http_client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    if let Ok(market_data) = response.json::<Value>().await {
                        let event = MarketEvent::new(
                            PlatformSource::Kalshi,
                            MarketEventKind::MarketMetadata,
                            market_id.to_string(),
                            market_data,
                            OffsetDateTime::now_utc(),
                        );
                        return Ok(Some(vec![event]));
                    }
                }
            }
            Err(e) => {
                warn!(error = %e, market_id = %market_id, "Failed to fetch Kalshi prices");
            }
        }
        
        Ok(None)
    }

    /// Fetch current prices from Thales
    async fn fetch_thales_prices(&self, market_id: &str) -> anyhow::Result<Option<Vec<MarketEvent>>> {
        // Thales API endpoint (this would need to be updated with actual Thales API)
        let url = format!("https://api.thales.io/markets/{}", market_id);
        
        match self.http_client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    if let Ok(market_data) = response.json::<Value>().await {
                        let event = MarketEvent::new(
                            PlatformSource::Thales,
                            MarketEventKind::MarketMetadata,
                            market_id.to_string(),
                            market_data,
                            OffsetDateTime::now_utc(),
                        );
                        return Ok(Some(vec![event]));
                    }
                }
            }
            Err(e) => {
                warn!(error = %e, market_id = %market_id, "Failed to fetch Thales prices");
            }
        }
        
        Ok(None)
    }

    /// Fetch current prices from Omen
    async fn fetch_omen_prices(&self, market_id: &str) -> anyhow::Result<Option<Vec<MarketEvent>>> {
        // Omen API endpoint (this would need to be updated with actual Omen API)
        let url = format!("https://api.omen.eth.link/markets/{}", market_id);
        
        match self.http_client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    if let Ok(market_data) = response.json::<Value>().await {
                        let event = MarketEvent::new(
                            PlatformSource::Omen,
                            MarketEventKind::MarketMetadata,
                            market_id.to_string(),
                            market_data,
                            OffsetDateTime::now_utc(),
                        );
                        return Ok(Some(vec![event]));
                    }
                }
            }
            Err(e) => {
                warn!(error = %e, market_id = %market_id, "Failed to fetch Omen prices");
            }
        }
        
        Ok(None)
    }

    /// Fetch prices for a specific event fingerprint (all markets for that event)
    pub async fn fetch_prices_for_event_fingerprint(&self, event_fingerprint: &str) -> anyhow::Result<usize> {
        let open_events = self.get_open_events().await?;
        let event_events: Vec<_> = open_events
            .into_iter()
            .filter(|event| event.event_fingerprint == event_fingerprint)
            .collect();

        let mut updated_count = 0;
        for event in event_events {
            match self.fetch_prices_for_event(&event).await {
                Ok(Some(market_events)) => {
                    for market_event in market_events {
                        if let Err(e) = self.price_indexer.index_prices_from_event(&market_event).await {
                            warn!(error = %e, event_id = %event.id, "Failed to index prices for event");
                        } else {
                            updated_count += 1;
                        }
                    }
                }
                Ok(None) => continue,
                Err(e) => {
                    warn!(error = %e, event_id = %event.id, "Failed to fetch prices for event");
                }
            }
        }

        Ok(updated_count)
    }

    /// Get price update statistics
    pub async fn get_price_update_stats(&self) -> anyhow::Result<PriceUpdateStats> {
        let conn = self.postgres.pool.get().await?;
        
        // Get total open events
        let total_events_row = conn.query_one(
            "SELECT COUNT(DISTINCT ae.id) FROM aggregated_events ae WHERE ae.status = 'active' AND ae.end_time > NOW()",
            &[]
        ).await?;
        let total_events: i64 = total_events_row.get(0);

        // Get total market sources
        let total_markets_row = conn.query_one(
            "SELECT COUNT(*) FROM market_sources ms JOIN aggregated_events ae ON ms.aggregated_event_id = ae.id WHERE ae.status = 'active' AND ae.end_time > NOW()",
            &[]
        ).await?;
        let total_markets: i64 = total_markets_row.get(0);

        // Get recent price updates (last hour)
        let recent_updates_row = conn.query_one(
            "SELECT COUNT(*) FROM price_history WHERE timestamp > NOW() - INTERVAL '1 hour'",
            &[]
        ).await?;
        let recent_updates: i64 = recent_updates_row.get(0);

        Ok(PriceUpdateStats {
            total_open_events: total_events as usize,
            total_markets: total_markets as usize,
            recent_price_updates: recent_updates as usize,
        })
    }
}

#[derive(Debug, Clone)]
struct OpenEvent {
    id: Uuid,
    event_fingerprint: String,
    title: String,
    source: String,
    market_id: String,
    market_slug: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PriceUpdateStats {
    pub total_open_events: usize,
    pub total_markets: usize,
    pub recent_price_updates: usize,
}
