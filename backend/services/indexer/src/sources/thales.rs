use crate::model::{MarketEvent, MarketEventKind, PlatformSource};
use time::OffsetDateTime;

pub struct ThalesSource;

impl ThalesSource { pub fn new() -> Self { Self } }

#[async_trait::async_trait]
impl crate::sources::Source for ThalesSource {
    fn name(&self) -> &'static str { "thales" }

    async fn run(&self, tx: tokio::sync::mpsc::Sender<MarketEvent>) -> anyhow::Result<()> {
        let client = reqwest::Client::new();
        // Updated to use the correct Thales API endpoint
        let endpoint = "https://api.thalesmarket.io/markets";
        loop {
            match client.get(endpoint).send().await {
                Ok(resp) => {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        let evt = MarketEvent::new(
                            PlatformSource::Thales,
                            MarketEventKind::MarketMetadata,
                            "thales:markets".into(),
                            json,
                            OffsetDateTime::now_utc(),
                        );
                        let _ = tx.send(evt).await;
                    }
                }
                Err(err) => tracing::warn!(error = %err, "thales rest request failed"),
            }
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    }
}


