use crate::model::{MarketEvent, MarketEventKind, PlatformSource};
use time::OffsetDateTime;

pub struct OmenSource;

impl OmenSource { pub fn new() -> Self { Self } }

#[async_trait::async_trait]
impl crate::sources::Source for OmenSource {
    fn name(&self) -> &'static str { "omen" }

    async fn run(&self, tx: tokio::sync::mpsc::Sender<MarketEvent>) -> anyhow::Result<()> {
        let client = reqwest::Client::new();
        let endpoint = "https://api.thegraph.com/subgraphs/name/gnosis/omen";
        let query = serde_json::json!({
            "query": "{ markets { id question outcomes status liquidity oracle { outcome } } }"
        });
        loop {
            match client.post(endpoint).json(&query).send().await {
                Ok(resp) => {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        let evt = MarketEvent::new(
                            PlatformSource::Omen,
                            MarketEventKind::MarketMetadata,
                            "omen:markets".into(),
                            json,
                            OffsetDateTime::now_utc(),
                        );
                        let _ = tx.send(evt).await;
                    }
                }
                Err(err) => tracing::warn!(error = %err, "omen subgraph request failed"),
            }
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    }
}


