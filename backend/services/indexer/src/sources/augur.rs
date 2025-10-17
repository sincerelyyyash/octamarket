use crate::model::{MarketEvent, MarketEventKind, PlatformSource};
use time::OffsetDateTime;

pub struct AugurSource;

impl AugurSource { pub fn new() -> Self { Self } }

#[async_trait::async_trait]
impl crate::sources::Source for AugurSource {
    fn name(&self) -> &'static str { "augur" }

    async fn run(&self, tx: tokio::sync::mpsc::Sender<MarketEvent>) -> anyhow::Result<()> {
        let client = reqwest::Client::new();
        let endpoint = "https://api.thegraph.com/subgraphs/name/augurproject/augur-v2";
        let query = serde_json::json!({
            "query": "{ markets { id title endTime volume outcomes { price } } }"
        });

        loop {
            match client.post(endpoint).json(&query).send().await {
                Ok(resp) => {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        let evt = MarketEvent::new(
                            PlatformSource::Augur,
                            MarketEventKind::MarketMetadata,
                            "augur:markets".into(),
                            json,
                            OffsetDateTime::now_utc(),
                        );
                        let _ = tx.send(evt).await;
                    }
                }
                Err(err) => tracing::warn!(error = %err, "augur subgraph request failed"),
            }
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    }
}


