
use anyhow::Context;
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub postgres_url: String,

    // API keys / auth
    pub kalshi_api_key: Option<String>,
    pub kalshi_api_secret: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let cfg = config::Config::builder()
            .add_source(config::Environment::default().separator("__"))
            .set_default("postgres_url", "postgres://postgres:postgres@localhost:5432/indexer")?
            .build()
            .context("building config from environment")?;

        let cfg: AppConfig = cfg
            .try_deserialize()
            .context("deserializing AppConfig from env")?;
        Ok(cfg)
    }

}


