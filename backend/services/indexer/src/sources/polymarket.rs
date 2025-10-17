use crate::model::{MarketEvent, MarketEventKind, PlatformSource};
use futures::StreamExt;
use time::OffsetDateTime;

pub struct PolymarketSource;

impl PolymarketSource {
    pub fn new() -> Self { Self }
}

#[async_trait::async_trait]
impl crate::sources::Source for PolymarketSource {
    fn name(&self) -> &'static str { "polymarket" }

    async fn run(&self, tx: tokio::sync::mpsc::Sender<MarketEvent>) -> anyhow::Result<()> {
        // REST polling for events metadata
        let client = reqwest::Client::new();
        let tx_rest = tx.clone();
        tokio::spawn(async move {
            let mut consecutive_errors = 0;
            loop {
                match client.get("https://gamma-api.polymarket.com/events").send().await {
                    Ok(resp) => {
                        if resp.status().is_success() {
                            if let Ok(json) = resp.json::<serde_json::Value>().await {
                                let evt = MarketEvent::new(
                                    PlatformSource::Polymarket,
                                    MarketEventKind::MarketMetadata,
                                    "polymarket:events".into(),
                                    json,
                                    OffsetDateTime::now_utc(),
                                );
                                if let Err(e) = tx_rest.send(evt).await {
                                    tracing::error!(error = %e, "failed to send polymarket event");
                                    break;
                                }
                            } else {
                                tracing::warn!("failed to parse polymarket response as JSON");
                            }
                            consecutive_errors = 0;
                        } else {
                            tracing::warn!("polymarket API returned status: {}", resp.status());
                            consecutive_errors += 1;
                        }
                    }
                    Err(err) => {
                        consecutive_errors += 1;
                        tracing::warn!(error = %err, "polymarket rest fetch failed");
                    }
                }
                
                // Exponential backoff on consecutive errors
                let sleep_duration = if consecutive_errors > 5 {
                    std::time::Duration::from_secs(300) // 5 minutes
                } else if consecutive_errors > 2 {
                    std::time::Duration::from_secs(120) // 2 minutes
                } else {
                    std::time::Duration::from_secs(30) // 30 seconds
                };
                
                tokio::time::sleep(sleep_duration).await;
            }
        });

        // WebSocket orderbook/trades subscription with reconnection
        let url = url::Url::parse("wss://ws-subscriptions-clob.polymarket.com/ws/market")?;
        let tx_ws = tx.clone();
        
        tokio::spawn(async move {
            loop {
                match tokio_tungstenite::connect_async(url.as_str()).await {
                    Ok((ws_stream, _resp)) => {
                        tracing::info!("polymarket websocket connected");
                        let (_write, mut read) = ws_stream.split();

                        while let Some(msg) = read.next().await {
                            match msg {
                                Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                        let market_id = json.get("market_id")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown")
                                            .to_string();
                                        
                                        let evt = MarketEvent::new(
                                            PlatformSource::Polymarket,
                                            MarketEventKind::Trade,
                                            market_id,
                                            json,
                                            OffsetDateTime::now_utc(),
                                        );
                                        if let Err(e) = tx_ws.send(evt).await {
                                            tracing::error!(error = %e, "failed to send websocket event");
                                            break;
                                        }
                                    }
                                }
                                Ok(_) => {}
                                Err(err) => {
                                    tracing::warn!(error = %err, "polymarket ws read error");
                                    break;
                                }
                            }
                        }
                    }
                    Err(err) => {
                        tracing::warn!(error = %err, "polymarket websocket connection failed, retrying in 5s");
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    }
                }
            }
        });

        Ok(())
    }
}


