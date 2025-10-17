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
            loop {
                match client.get("https://gamma-api.polymarket.com/events").send().await {
                    Ok(resp) => {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        let evt = MarketEvent::new(
                            PlatformSource::Polymarket,
                            MarketEventKind::MarketMetadata,
                            "polymarket:events".into(),
                            json,
                            OffsetDateTime::now_utc(),
                        );
                        let _ = tx_rest.send(evt).await;
                    }
                    }
                    Err(err) => {
                        tracing::warn!(error = %err, "polymarket rest fetch failed");
                    }
                }
                tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            }
        });

        // WebSocket orderbook/trades subscription skeleton
        let url = url::Url::parse("wss://ws-subscriptions-clob.polymarket.com/ws/market")?;
        let (ws_stream, _resp) = tokio_tungstenite::connect_async(url.as_str()).await?;
        let (_write, mut read) = ws_stream.split();

        while let Some(msg) = read.next().await {
            match msg {
                Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        let evt = MarketEvent::new(
                            PlatformSource::Polymarket,
                            MarketEventKind::Trade,
                            json.get("market_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            json,
                            OffsetDateTime::now_utc(),
                        );
                        let _ = tx.send(evt).await;
                    }
                }
                Ok(_) => {}
                Err(err) => {
                    tracing::warn!(error = %err, "polymarket ws read error");
                    break;
                }
            }
        }

        Ok(())
    }
}


