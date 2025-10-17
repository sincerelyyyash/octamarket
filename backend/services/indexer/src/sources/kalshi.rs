use crate::model::{MarketEvent, MarketEventKind, PlatformSource};
use time::OffsetDateTime;

pub struct KalshiSource {
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
}

impl KalshiSource {
    pub fn new(api_key: Option<String>, api_secret: Option<String>) -> Self { Self { api_key, api_secret } }
}

#[async_trait::async_trait]
impl crate::sources::Source for KalshiSource {
    fn name(&self) -> &'static str { "kalshi" }

    async fn run(&self, tx: tokio::sync::mpsc::Sender<MarketEvent>) -> anyhow::Result<()> {
        let client = reqwest::Client::new();
        let mut req = client.get("https://api.kalshi.com/markets");
        if let (Some(key), Some(secret)) = (&self.api_key, &self.api_secret) {
            req = req.header("X-API-KEY", key).header("X-API-SECRET", secret);
        }
        loop {
            match req.try_clone().unwrap().send().await {
                Ok(resp) => {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        let evt = MarketEvent::new(
                            PlatformSource::Kalshi,
                            MarketEventKind::MarketMetadata,
                            "kalshi:markets".into(),
                            json,
                            OffsetDateTime::now_utc(),
                        );
                        let _ = tx.send(evt).await;
                    }
                }
                Err(err) => tracing::warn!(error = %err, "kalshi rest request failed"),
            }
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    }
}


