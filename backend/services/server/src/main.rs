mod auth;
mod config;
mod db;
mod errors;
mod handlers;
mod models;
mod routes;

use auth::init_jwt_secret;
use config::Config;
use db::Database;
use routes::create_router;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    // Load environment variables
    dotenvy::dotenv().ok();
    
    // Load configuration
    let config = Config::from_env()?;
    tracing::info!("Starting copy trading server");
    
    // Initialize JWT secret
    init_jwt_secret(config.jwt_secret.clone());
    
    // Connect to database
    tracing::info!("Connecting to database...");
    let db = Database::new(&config.database_url).await?;
    tracing::info!("Database connected successfully");
    
    // Create router
    let app = create_router(db, &config);
    
    // Start server
    let addr = config.server_addr();
    tracing::info!("Copy trading server listening on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}
