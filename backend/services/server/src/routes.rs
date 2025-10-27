use axum::{
    routing::{delete, get, patch, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::config::Config;
use crate::db::DualDatabase;
use crate::handlers::*;
use crate::order_executor::OrderRouter;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: DualDatabase,
    pub order_router: Arc<OrderRouter>,
}

pub fn create_router(db: DualDatabase, config: &Config) -> Router {
    // Configure CORS
    let cors = if config.allowed_origins.len() == 1 && config.allowed_origins[0] == "*" {
        CorsLayer::permissive()
    } else {
        let mut cors = CorsLayer::new()
            .allow_methods(Any)
            .allow_headers(Any);
        
        for origin in &config.allowed_origins {
            cors = cors.allow_origin(origin.parse::<http::HeaderValue>().unwrap());
        }
        
        cors
    };

    // Initialize app state
    let state = AppState {
        db,
        order_router: Arc::new(OrderRouter::default()),
    };

    Router::new()
        // Health check
        .route("/health", get(health))
        
        // Authentication routes
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        
        // Market aggregation routes (public)
        .route("/markets", get(get_markets))
        .route("/markets/:event_fingerprint/sources", get(get_market_sources))
        .route("/markets/:event_fingerprint/best-price", get(get_best_price))
        
        // Leader routes (public)
        .route("/leaders", get(get_leaders))
        .route("/leaders/:leader_id", get(get_leader))
        .route("/wallet-leaderboard", get(get_wallet_leaderboard))
        .route("/wallets/:wallet_address/trades", get(get_wallet_trades))
        
        // Arbitrage routes (public)
        .route("/arbitrage/opportunities", get(get_arbitrage_opportunities))
        .route("/arbitrage/opportunities/:id", get(get_arbitrage_opportunity))
        
        // Order routes (protected)
        .route("/orders/place", post(place_order))
        .route("/orders/my", get(get_my_orders))
        .route("/orders/:order_id/cancel", delete(cancel_order))
        
        // Wallet routes (protected)
        .route("/wallets/connect", post(connect_wallet))
        .route("/wallets/my", get(get_my_wallets))
        
        // Copy trading routes (stubs for now)
        .route("/follow", post(post_follow))
        .route("/follow/:follow_id", patch(patch_follow))
        .route("/follow/:follow_id/pause", post(post_pause))
        .route("/follow/:follow_id/resume", post(post_resume))
        .route("/follows/me", get(get_follows_me))
        .route("/unfollow", post(post_unfollow))
        
        // Trade event routes
        .route("/events/leader-trade", post(post_leader_trade))
        
        // Job routes
        .route("/jobs/replications", get(get_jobs))
        .route("/jobs/replications/:job_id/complete", post(post_job_complete))
        
        // Portfolio routes
        .route("/positions", get(get_positions))
        .route("/orders", get(get_orders))
        
        // Add state and middleware
        .with_state(state)
        .layer(cors)
}


