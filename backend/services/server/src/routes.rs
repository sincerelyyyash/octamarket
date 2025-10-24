use axum::{
    routing::{get, patch, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::config::Config;
use crate::db::Database;
use crate::handlers::*;

pub fn create_router(db: Database, config: &Config) -> Router {
    // Configure CORS
    let cors = if config.allowed_origins.len() == 1 && config.allowed_origins[0] == "*" {
        CorsLayer::permissive()
    } else {
        let mut cors = CorsLayer::new()
            .allow_methods(Any)
            .allow_headers(Any);
        
        for origin in &config.allowed_origins {
            match origin.parse::<http::HeaderValue>() {
                Ok(header_value) => {
                    cors = cors.allow_origin(header_value);
                }
                Err(e) => {
                    tracing::warn!("Invalid CORS origin '{}': {}", origin, e);
                    // Skip invalid origins instead of panicking
                }
            }
        }
        
        cors
    };

    Router::new()
        // Health check and metrics
        .route("/health", get(health))
        .route("/metrics", get(metrics))
        
        // Auth routes (public)
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        
        // Leader routes (public)
        .route("/leaders", get(get_leaders))
        .route("/leaders/{leader_id}", get(get_leader))
        
        // Follow routes (protected)
        .route("/follow", post(post_follow))
        .route("/follow/{follow_id}", patch(patch_follow))
        .route("/follow/{follow_id}/pause", post(post_pause))
        .route("/follow/{follow_id}/resume", post(post_resume))
        .route("/follow/{follow_id}/close-all", post(post_close_all))
        .route("/follows/me", get(get_follows_me))
        .route("/unfollow", post(post_unfollow))
        
        // Trade event routes (protected - for system/webhooks)
        .route("/events/leader-trade", post(post_leader_trade))
        
        // Job routes (protected - for worker services)
        .route("/jobs/replications", get(get_jobs))
        .route("/jobs/replications/{job_id}/complete", post(post_job_complete))
        
        // Portfolio routes (protected)
        .route("/positions", get(get_positions))
        .route("/orders", get(get_orders))
        
        // Market data routes (public)
        .route("/events", get(get_events))
        .route("/events/{event_fingerprint}", get(get_event))
        .route("/markets", get(get_markets))
        .route("/markets/{market_source_id}", get(get_market_source))
        .route("/markets/{market_source_id}/price-history", get(get_price_history))
        .route("/markets/{market_source_id}/price-trends", get(get_price_trends))
        
        // Maintenance routes (protected)
        .route("/admin/cleanup/idempotency", post(cleanup_idempotency_keys))
        
        // Add state and middleware
        .with_state(db)
        .layer(cors)
}
