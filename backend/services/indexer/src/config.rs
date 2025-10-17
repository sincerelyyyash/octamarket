
use anyhow::Context;
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub kafka_brokers: String,
    pub redis_url: String,
    pub postgres_url: String,

    // API keys / auth
    pub kalshi_api_key: Option<String>,
    pub kalshi_api_secret: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let mut cfg = config::Config::builder()
            .add_source(config::Environment::default().separator("__"))
            .build()
            .context("building config from environment")?;

        // Default placeholders for required items to give clearer errors
        cfg.set_default("kafka_brokers", "localhost:9092").ok();
        cfg.set_default("redis_url", "redis://127.0.0.1:6379").ok();
        cfg.set_default("postgres_url", "postgres://postgres:postgres@localhost:5432/indexer").ok();

        let cfg: AppConfig = cfg
            .try_deserialize()
            .context("deserializing AppConfig from env")?;
        Ok(cfg)
    }

}


