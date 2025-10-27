use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};

use crate::auth::{AuthUser, create_token};
use crate::errors::ApiError;
use crate::models::*;
use crate::routes::AppState;

// ==================== Auth Handlers ====================

pub async fn register(
    State(state): State<AppState>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    let db = &state.db;
    let password_hash = bcrypt::hash(&request.password, bcrypt::DEFAULT_COST)
        .map_err(|_| ApiError::Internal("Failed to hash password".to_string()))?;

    let user_id = db.create_user(&request.email, &password_hash).await?;
    let token = create_token(&user_id)?;

    Ok(Json(AuthResponse { token, user_id }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    let db = &state.db;
    let user = db
        .get_user_by_email(&request.email)
        .await?
        .ok_or(ApiError::Validation("Invalid credentials".to_string()))?;

    let valid = bcrypt::verify(&request.password, &user.password_hash)
        .map_err(|_| ApiError::Internal("Failed to verify password".to_string()))?;

    if !valid {
        return Err(ApiError::Validation("Invalid credentials".to_string()));
    }

    let token = create_token(&user.user_id)?;

    Ok(Json(AuthResponse {
        token,
        user_id: user.user_id,
    }))
}

// ==================== Market Aggregation Handlers ====================

pub async fn get_markets(
    State(state): State<AppState>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<Vec<AggregatedMarketView>>, ApiError> {
    let db = &state.db;
    let markets = db.get_aggregated_markets(pagination.limit).await?;
    Ok(Json(markets))
}

pub async fn get_market_sources(
    Path(event_fingerprint): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Vec<MarketSourceView>>, ApiError> {
    let db = &state.db;
    let sources = db.get_market_sources_for_event(&event_fingerprint).await?;
    Ok(Json(sources))
}

// ==================== Leader Handlers ====================

pub async fn get_leaders(
    State(state): State<AppState>,
) -> Result<Json<Vec<LeaderWithStats>>, ApiError> {
    let db = &state.db;
    let leaders = db.get_leaders().await?;
    Ok(Json(leaders))
}

pub async fn get_leader(
    Path(leader_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<LeaderDetail>, ApiError> {
    let db = &state.db;
    let leader = db.get_leader(&leader_id).await?;
    Ok(Json(leader))
}

pub async fn get_wallet_leaderboard(
    State(state): State<AppState>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<Vec<WalletLeaderboardEntry>>, ApiError> {
    let db = &state.db;
    let leaderboard = db.get_wallet_leaderboard(pagination.limit).await?;
    Ok(Json(leaderboard))
}

pub async fn get_wallet_trades(
    Path(wallet_address): Path<String>,
    State(state): State<AppState>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<Vec<WalletTradeView>>, ApiError> {
    let db = &state.db;
    let trades = db.get_wallet_trades(&wallet_address, pagination.limit).await?;
    Ok(Json(trades))
}

// ==================== Arbitrage Handlers ====================

use crate::arbitrage::AlertManager;
use crate::aggregator::PriceAggregator;

pub async fn get_arbitrage_opportunities(
    State(state): State<AppState>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<Vec<ArbitrageAlert>>, ApiError> {
    let pool = state.db.trading_pool().clone();
    let alert_manager = AlertManager::new(pool);
    let opportunities = alert_manager.get_active_alerts(pagination.limit).await
        .map_err(|e| ApiError::Database(e))?;
    Ok(Json(opportunities))
}

pub async fn get_arbitrage_opportunity(
    Path(opportunity_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ArbitrageAlert>, ApiError> {
    let pool = state.db.trading_pool().clone();
    
    let opportunity = sqlx::query_as::<_, ArbitrageAlert>(
        "SELECT * FROM arbitrage_alerts WHERE id = $1"
    )
    .bind(&opportunity_id)
    .fetch_optional(&pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    
    Ok(Json(opportunity))
}

// ==================== Order Handlers ====================


pub async fn place_order(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(request): Json<PlaceOrderRequest>,
) -> Result<Json<OrderResponse>, ApiError> {
    let user_id = &auth.user_id;
    
    // Get user's wallet for the platform
    let wallet = sqlx::query_as::<_, UserWallet>(
        "SELECT * FROM user_wallets WHERE user_id = $1 AND platform = $2 AND is_primary = true"
    )
    .bind(user_id)
    .bind(request.platform.as_deref().unwrap_or("polymarket"))
    .fetch_optional(state.db.trading_pool())
    .await?
    .ok_or_else(|| ApiError::Validation("No wallet connected for this platform".to_string()))?;
    
    // Place order through router
    let response = state.order_router.route_order(request.clone(), &wallet.wallet_address)
        .await
        .map_err(|e| ApiError::Validation(e.to_string()))?;
    
    // Store order in database
    let order_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO user_orders (
            id, user_id, platform, market_id, event_fingerprint, side, outcome,
            outcome_index, price, amount, order_type, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#
    )
    .bind(&order_id)
    .bind(user_id)
    .bind(request.platform.unwrap_or_else(|| "polymarket".to_string()))
    .bind(&request.market_id)
    .bind::<Option<String>>(None)
    .bind(&request.side)
    .bind(&request.outcome)
    .bind::<Option<i32>>(None)
    .bind(request.price)
    .bind(request.amount)
    .bind(&request.order_type)
    .bind("pending")
    .execute(state.db.trading_pool())
    .await?;
    
    Ok(Json(response))
}

pub async fn get_my_orders(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<Vec<UserOrder>>, ApiError> {
    let user_id = &auth.user_id;
    let limit = pagination.limit.unwrap_or(50);
    
    let orders = sqlx::query_as::<_, UserOrder>(
        "SELECT * FROM user_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2"
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(state.db.trading_pool())
    .await?;
    
    Ok(Json(orders))
}

pub async fn cancel_order(
    auth: AuthUser,
    Path(order_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<SuccessResponse>, ApiError> {
    let user_id = &auth.user_id;
    
    // Get order to verify ownership and get platform
    let order = sqlx::query_as::<_, UserOrder>(
        "SELECT * FROM user_orders WHERE id = $1 AND user_id = $2"
    )
    .bind(&order_id)
    .bind(user_id)
    .fetch_optional(state.db.trading_pool())
    .await?
    .ok_or(ApiError::NotFound)?;
    
    // Cancel order through router
    if let Some(venue_order_id) = &order.venue_order_id {
        state.order_router.cancel_order(&order.platform, venue_order_id)
            .await
            .map_err(|e| ApiError::Validation(e.to_string()))?;
    }
    
    // Update order status
    sqlx::query("UPDATE user_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1")
        .bind(&order_id)
        .execute(state.db.trading_pool())
        .await?;
    
    Ok(Json(SuccessResponse {
        success: true,
        message: Some("Order cancelled".to_string()),
    }))
}

// ==================== Wallet Handlers ====================

pub async fn connect_wallet(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(request): Json<ConnectWalletRequest>,
) -> Result<Json<UserWallet>, ApiError> {
    let user_id = &auth.user_id;
    
    // TODO: Verify signature
    // For MVP, we'll skip signature verification
    
    let wallet_id = uuid::Uuid::new_v4().to_string();
    
    sqlx::query(
        r#"
        INSERT INTO user_wallets (id, user_id, platform, wallet_address, is_primary, is_verified)
        VALUES ($1, $2, $3, $4, false, true)
        ON CONFLICT (platform, wallet_address) DO NOTHING
        "#
    )
    .bind(&wallet_id)
    .bind(user_id)
    .bind(&request.platform)
    .bind(&request.wallet_address)
    .execute(state.db.trading_pool())
    .await?;
    
    let wallet = sqlx::query_as::<_, UserWallet>(
        "SELECT * FROM user_wallets WHERE user_id = $1 AND wallet_address = $2"
    )
    .bind(user_id)
    .bind(&request.wallet_address)
    .fetch_one(state.db.trading_pool())
    .await?;
    
    Ok(Json(wallet))
}

pub async fn get_my_wallets(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<UserWallet>>, ApiError> {
    let user_id = &auth.user_id;
    
    let wallets = sqlx::query_as::<_, UserWallet>(
        "SELECT * FROM user_wallets WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(state.db.trading_pool())
    .await?;
    
    Ok(Json(wallets))
}

// ==================== Best Price Handlers ====================

use crate::aggregator::BestPriceFinder;

pub async fn get_best_price(
    Path(event_fingerprint): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<BestPrice>, ApiError> {
    let aggregator = PriceAggregator::new(state.db.clone());
    let finder = BestPriceFinder::new(aggregator);
    
    // First try to get from cache
    let pool = state.db.trading_pool().clone();
    let cache_manager = crate::aggregator::CacheManager::new(pool);
    
    if let Ok(Some(cached_price)) = cache_manager.get_cached_price(&event_fingerprint).await {
        return Ok(Json(cached_price));
    }
    
    // If not in cache, calculate it
    let markets = state.db.get_aggregated_markets(Some(1000)).await?;
    let market = markets.iter()
        .find(|m| m.event_fingerprint == event_fingerprint)
        .ok_or(ApiError::NotFound)?;
    
    let best_price = finder.find_best_prices(&event_fingerprint, &market.title).await?;
    
    Ok(Json(best_price))
}

// ==================== Copy Trading Handler Stubs ====================
// These are placeholder implementations for copy trading features

pub async fn post_follow() -> Json<SuccessResponse> {
    Json(SuccessResponse {
        success: true,
        message: Some("Follow functionality coming soon".to_string()),
    })
}

pub async fn patch_follow() -> Json<SuccessResponse> {
    Json(SuccessResponse {
        success: true,
        message: Some("Update follow functionality coming soon".to_string()),
    })
}

pub async fn post_pause() -> Json<SuccessResponse> {
    Json(SuccessResponse {
        success: true,
        message: Some("Pause functionality coming soon".to_string()),
    })
}

pub async fn post_resume() -> Json<SuccessResponse> {
    Json(SuccessResponse {
        success: true,
        message: Some("Resume functionality coming soon".to_string()),
    })
}

pub async fn get_follows_me() -> Json<Vec<String>> {
    Json(vec![])
}

pub async fn post_unfollow() -> Json<SuccessResponse> {
    Json(SuccessResponse {
        success: true,
        message: Some("Unfollow functionality coming soon".to_string()),
    })
}

pub async fn post_leader_trade() -> Json<SuccessResponse> {
    Json(SuccessResponse {
        success: true,
        message: Some("Leader trade functionality coming soon".to_string()),
    })
}

pub async fn get_jobs() -> Json<Vec<String>> {
    Json(vec![])
}

pub async fn post_job_complete() -> Json<SuccessResponse> {
    Json(SuccessResponse {
        success: true,
        message: Some("Job complete functionality coming soon".to_string()),
    })
}

pub async fn get_positions() -> Json<Vec<UserPosition>> {
    Json(vec![])
}

pub async fn get_orders() -> Json<Vec<UserOrder>> {
    Json(vec![])
}

// ==================== Health Check ====================

#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

pub async fn health() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}


