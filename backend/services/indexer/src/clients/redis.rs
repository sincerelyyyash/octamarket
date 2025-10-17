use anyhow::Context;
use redis::{aio::ConnectionManager, AsyncCommands, Client};

pub struct RedisClient {
    manager: ConnectionManager,
}

impl RedisClient {
    pub async fn new(url: &str) -> anyhow::Result<Self> {
        let client = Client::open(url).context("opening redis client")?;
        let conn = client.get_connection_manager().await.context("redis connect")?;
        Ok(Self { manager: conn })
    }

    pub async fn set_json(&mut self, key: &str, value: &serde_json::Value) -> anyhow::Result<()> {
        let payload = serde_json::to_string(value)?;
        let _: () = self.manager.set(key, payload).await?;
        Ok(())
    }
}




