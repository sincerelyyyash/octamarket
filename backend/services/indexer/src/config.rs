
use anyhow::Context;
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub postgres_url: String,

    // API keys / auth
    pub kalshi_api_key: Option<String>,
    pub kalshi_api_secret: Option<String>,
    
    // Price fetching configuration
    pub price_fetch_interval_seconds: Option<u64>,
    
    // Rate limiting configuration
    pub max_requests_per_minute: Option<u32>,
    pub request_timeout_seconds: Option<u64>,
    
    // Retry configuration
    pub max_retry_attempts: Option<u32>,
    pub retry_delay_seconds: Option<u64>,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let cfg = config::Config::builder()
            .add_source(config::Environment::default().separator("__"))
            .set_default("postgres_url", "postgres://postgres:postgres@localhost:5432/indexer")?
            .set_default("price_fetch_interval_seconds", 60)?
            .set_default("max_requests_per_minute", 100)?
            .set_default("request_timeout_seconds", 30)?
            .set_default("max_retry_attempts", 3)?
            .set_default("retry_delay_seconds", 5)?
            .build()
            .context("building config from environment")?;

        let cfg: AppConfig = cfg
            .try_deserialize()
            .context("deserializing AppConfig from env")?;
        
        // Validate configuration
        cfg.validate()?;
        
        Ok(cfg)
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        if self.postgres_url.is_empty() {
            return Err(anyhow::anyhow!("postgres_url cannot be empty"));
        }
        
        if let Some(interval) = self.price_fetch_interval_seconds {
            if interval == 0 {
                return Err(anyhow::anyhow!("price_fetch_interval_seconds must be greater than 0"));
            }
            if interval < 10 {
                tracing::warn!("price_fetch_interval_seconds is very low ({}), this may cause rate limiting", interval);
            }
        }
        
        if let Some(max_requests) = self.max_requests_per_minute {
            if max_requests == 0 {
                return Err(anyhow::anyhow!("max_requests_per_minute must be greater than 0"));
            }
            if max_requests > 1000 {
                tracing::warn!("max_requests_per_minute is very high ({}), this may overwhelm APIs", max_requests);
            }
        }
        
        if let Some(timeout) = self.request_timeout_seconds {
            if timeout == 0 {
                return Err(anyhow::anyhow!("request_timeout_seconds must be greater than 0"));
            }
            if timeout > 300 {
                tracing::warn!("request_timeout_seconds is very high ({}), this may cause slow responses", timeout);
            }
        }
        
        Ok(())
    }
}


