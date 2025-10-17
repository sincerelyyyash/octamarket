use dotenvy::dotenv;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod config;
mod fingerprint;
mod model;
mod normalizer;
mod pipeline;
mod clients;
mod sources;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::AppConfig::from_env()?;

    // Build pipeline (sources -> normalizer -> clients)
    let pipeline = pipeline::IndexerPipeline::new(cfg).await?;

    // Run all sources
    pipeline.run_all().await?;

    Ok(())
}

