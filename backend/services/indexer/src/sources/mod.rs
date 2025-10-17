pub mod polymarket;
pub mod augur;
pub mod kalshi;
pub mod thales;
pub mod omen;

use async_trait::async_trait;

use crate::model::MarketEvent;

#[async_trait]
pub trait Source: Send + Sync {
    async fn run(&self, tx: tokio::sync::mpsc::Sender<MarketEvent>) -> anyhow::Result<()>;
    fn name(&self) -> &'static str;
}


