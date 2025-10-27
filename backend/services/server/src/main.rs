mod auth;
mod config;
mod db;
mod errors;
mod handlers;
mod models;
mod routes;
mod aggregator;
mod arbitrage;
mod order_executor;

use auth::init_jwt_secret;
use config::Config;
use db::DualDatabase;
use routes::create_router;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use aggregator::{PriceAggregator, BestPriceFinder, CacheManager};
use arbitrage::{ArbitrageDetector, AlertManager};

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
    tracing::info!("Starting Octamarket trading server");
    tracing::info!("Trading DB: {}", config.database_url);
    tracing::info!("Indexer DB: {}", config.indexer_db_url);
    
    // Initialize JWT secret
    init_jwt_secret(config.jwt_secret.clone());
    
    // Connect to both databases
    tracing::info!("Connecting to databases...");
    let db = DualDatabase::new(&config.database_url, &config.indexer_db_url).await?;
    tracing::info!("Database connections established");
    
    // Start background tasks
    start_background_tasks(db.clone(), &config).await;
    
    // Create router
    let app = create_router(db, &config);
    
    // Start server
    let addr = config.server_addr();
    tracing::info!("Octamarket server listening on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

/// Start all background tasks
async fn start_background_tasks(db: DualDatabase, config: &Config) {
    // Task 1: Best prices cache refresh
    {
        let db_clone = db.clone();
        let interval = config.cache_refresh_interval_seconds;
        
        tokio::spawn(async move {
            tracing::info!("Starting best prices cache refresh (interval: {}s)", interval);
            let mut interval_timer = tokio::time::interval(std::time::Duration::from_secs(interval));
            
            loop {
                interval_timer.tick().await;
                
                let aggregator = PriceAggregator::new(db_clone.clone());
                let finder = BestPriceFinder::new(aggregator);
                let cache_manager = CacheManager::new(db_clone.trading_pool().clone());
                
                match finder.find_all_best_prices().await {
                    Ok(best_prices) => {
                        if let Err(e) = cache_manager.update_cache(best_prices).await {
                            tracing::error!(error = %e, "Failed to update best prices cache");
                        } else {
                            tracing::debug!("Best prices cache updated successfully");
                        }
                    }
                    Err(e) => {
                        tracing::error!(error = %e, "Failed to find best prices");
                    }
                }
            }
        });
    }
    
    // Task 2: Arbitrage opportunity scanning
    {
        let db_clone = db.clone();
        let min_profit_pct = config.arbitrage_min_profit_pct;
        let scan_interval = config.arbitrage_scan_interval_seconds;
        
        tokio::spawn(async move {
            tracing::info!("Starting arbitrage scanning (interval: {}s, min profit: {}%)", scan_interval, min_profit_pct);
            let mut interval_timer = tokio::time::interval(std::time::Duration::from_secs(scan_interval));
            
            loop {
                interval_timer.tick().await;
                
                let aggregator = PriceAggregator::new(db_clone.clone());
                let detector = ArbitrageDetector::new(aggregator, min_profit_pct);
                let alert_manager = AlertManager::new(db_clone.trading_pool().clone());
                
                match detector.scan_all_markets().await {
                    Ok(opportunities) => {
                        tracing::info!("Found {} arbitrage opportunities", opportunities.len());
                        
                        for opportunity in opportunities {
                            if let Err(e) = alert_manager.create_alert(opportunity).await {
                                tracing::error!(error = %e, "Failed to create arbitrage alert");
                            }
                        }
                        
                        // Expire old alerts (older than 5 minutes)
                        if let Err(e) = alert_manager.expire_old_alerts(300).await {
                            tracing::error!(error = %e, "Failed to expire old arbitrage alerts");
                        }
                    }
                    Err(e) => {
                        tracing::error!(error = %e, "Failed to scan for arbitrage opportunities");
                    }
                }
            }
        });
    }
    
    tracing::info!("All background tasks started");
}


