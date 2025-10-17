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
            match req.try_clone() {
                Some(cloned_req) => {
                    match cloned_req.send().await {
                        Ok(resp) => {
                            if resp.status().is_success() {
                                if let Ok(json) = resp.json::<serde_json::Value>().await {
                                    let evt = MarketEvent::new(
                                        PlatformSource::Kalshi,
                                        MarketEventKind::MarketMetadata,
                                        "kalshi:markets".into(),
                                        json,
                                        OffsetDateTime::now_utc(),
                                    );
                                    if let Err(e) = tx.send(evt).await {
                                        tracing::error!(error = %e, "failed to send kalshi event");
                                        return Ok(());
                                    }
                                } else {
                                    tracing::warn!("failed to parse kalshi response as JSON");
                                }
                            } else {
                                tracing::warn!("kalshi API returned status: {}", resp.status());
                            }
                        }
                        Err(err) => tracing::warn!(error = %err, "kalshi rest request failed"),
                    }
                }
                None => {
                    tracing::error!("failed to clone kalshi request");
                    return Ok(());
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    }
}


