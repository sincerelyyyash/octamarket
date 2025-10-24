use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::auth::{create_token, hash_password, verify_password, AuthUser};
use crate::db::Database;
use crate::errors::ApiError;
use crate::models::*;

// ---------- Helper Functions

fn idempotency_key_from(headers: &HeaderMap) -> Option<String> {
    use http::header::HeaderName;
    static IDEMP: HeaderName = HeaderName::from_static("idempotency-key");
    headers
        .get(&IDEMP)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}


// ---------- Health Check

pub async fn health(State(db): State<Database>) -> impl IntoResponse {
    // Check database connectivity
    let db_healthy = match db.pool().acquire().await {
        Ok(_) => true,
        Err(_) => false,
    };
    
    let status = if db_healthy { "healthy" } else { "unhealthy" };
    
    Json(serde_json::json!({
        "status": status,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "database": if db_healthy { "connected" } else { "disconnected" }
    }))
}

pub async fn metrics(State(db): State<Database>) -> impl IntoResponse {
    // Get basic metrics from the database
    let mut metrics = serde_json::json!({
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "database": "connected"
    });
    
    // Try to get some basic counts using the pool directly
    // Get user count
    if let Ok(user_count) = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(db.pool()).await {
        metrics["users"] = serde_json::json!(user_count);
    }
    
    // Get active follows count
    if let Ok(follows_count) = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM follows WHERE status = 'active'")
        .fetch_one(db.pool()).await {
        metrics["active_follows"] = serde_json::json!(follows_count);
    }
    
    // Get pending jobs count
    if let Ok(jobs_count) = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM replication_jobs WHERE status = 'pending'")
        .fetch_one(db.pool()).await {
        metrics["pending_jobs"] = serde_json::json!(jobs_count);
    }
    
    Json(metrics)
}

// ---------- Auth Handlers

pub async fn register(
    State(db): State<Database>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    // Validate email format
    if !body.email.contains('@') || body.email.len() < 3 {
        return Err(ApiError::Validation("Invalid email format".to_string()));
    }

    // Validate password strength
    if body.password.len() < 8 {
        return Err(ApiError::Validation("Password must be at least 8 characters".to_string()));
    }

    // Hash password
    let password_hash = hash_password(&body.password)?;

    // Create user
    let user_id = db.create_user(&body.email, &password_hash).await?;

    // Generate token
    let token = create_token(&user_id)?;

    Ok(Json(AuthResponse { token, user_id }))
}

pub async fn login(
    State(db): State<Database>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    // Get user by email
    let user = db
        .get_user_by_email(&body.email)
        .await?
        .ok_or(ApiError::Unauthorized)?;

    // Verify password
    let valid = verify_password(&body.password, &user.password_hash)?;
    if !valid {
        return Err(ApiError::Unauthorized);
    }

    // Generate token
    let token = create_token(&user.user_id)?;

    Ok(Json(AuthResponse {
        token,
        user_id: user.user_id,
    }))
}

// ---------- Leader Handlers

pub async fn get_leaders(State(db): State<Database>) -> Result<Json<Vec<Leader>>, ApiError> {
    let leaders = db.get_leaders().await?;
    Ok(Json(leaders))
}

pub async fn get_leader(
    Path(leader_id): Path<String>,
    State(db): State<Database>,
) -> Result<Json<LeaderDetail>, ApiError> {
    let leader = db.get_leader(&leader_id).await?;
    Ok(Json(leader))
}

// ---------- Follow Handlers

pub async fn post_follow(
    auth: AuthUser,
    State(db): State<Database>,
    Json(body): Json<FollowCreate>,
) -> Result<impl IntoResponse, ApiError> {
    let user_id = &auth.user_id;
    
    // Validate
    body.validate().map_err(ApiError::Validation)?;
    
    // Verify leader exists
    let _ = db.get_leader(&body.leader_id).await?;
    
    let follow_id = db.create_follow(user_id, &body).await?;
    
    let res = serde_json::json!({ 
        "followId": follow_id, 
        "status": "active" 
    });
    
    Ok((StatusCode::CREATED, Json(res)))
}

pub async fn patch_follow(
    auth: AuthUser,
    Path(follow_id): Path<String>,
    State(db): State<Database>,
    Json(update): Json<FollowUpdate>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Validate
    update.validate().map_err(ApiError::Validation)?;
    
    // Verify ownership
    let follow = db.get_follow(&follow_id).await?;
    if follow.user_id != auth.user_id {
        return Err(ApiError::Forbidden);
    }
    
    db.update_follow(&follow_id, &update).await?;
    
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn get_follows_me(
    auth: AuthUser,
    State(db): State<Database>,
    _q: Query<FollowsMeQuery>,
) -> Result<Json<Vec<FollowView>>, ApiError> {
    let user_id = &auth.user_id;
    let follows = db.get_user_follows(user_id).await?;
    Ok(Json(follows))
}

pub async fn post_unfollow(
    auth: AuthUser,
    State(db): State<Database>,
    Json(body): Json<Unfollow>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = &auth.user_id;
    
    db.unfollow_leader(user_id, &body.leader_id, &body.action).await?;
    
    let status = match body.action.as_str() {
        "pause" => "paused",
        "stop" => "stopped",
        _ => return Err(ApiError::Validation("Invalid action".to_string())),
    };
    
    Ok(Json(serde_json::json!({ "status": status })))
}

pub async fn post_pause(
    auth: AuthUser,
    Path(follow_id): Path<String>,
    State(db): State<Database>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Verify ownership
    let follow = db.get_follow(&follow_id).await?;
    if follow.user_id != auth.user_id {
        return Err(ApiError::Forbidden);
    }
    
    db.update_follow_status(&follow_id, "paused").await?;
    Ok(Json(serde_json::json!({ "status": "paused" })))
}

pub async fn post_resume(
    auth: AuthUser,
    Path(follow_id): Path<String>,
    State(db): State<Database>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Verify ownership
    let follow = db.get_follow(&follow_id).await?;
    if follow.user_id != auth.user_id {
        return Err(ApiError::Forbidden);
    }
    
    db.update_follow_status(&follow_id, "active").await?;
    Ok(Json(serde_json::json!({ "status": "active" })))
}

pub async fn post_close_all(
    auth: AuthUser,
    Path(follow_id): Path<String>,
    State(db): State<Database>,
    Json(body): Json<CloseAllReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Verify ownership
    let follow = db.get_follow(&follow_id).await?;
    if follow.user_id != auth.user_id {
        return Err(ApiError::Forbidden);
    }
    
    // Get all positions for this follow
    let positions = db.get_user_positions_for_follow(&auth.user_id, &follow_id).await?;
    let positions_count = positions.len();
    
    if positions.is_empty() {
        return Ok(Json(serde_json::json!({ 
            "accepted": true, 
            "message": "No positions to close",
            "jobs_created": 0 
        })));
    }
    
    let mut jobs_created = 0;
    let mut errors = Vec::new();
    
    // Create close jobs for each position
    for position in positions {
        match db.create_close_job(
            &auth.user_id,
            &follow_id,
            &position.market_source_id,
            &position.side,
            position.size_usdc,
            &body.mode,
            body.slippage_bps,
        ).await {
            Ok(_job_id) => {
                jobs_created += 1;
            }
            Err(e) => {
                errors.push(format!("Failed to create close job for position {}: {}", position.market_source_id, e));
            }
        }
    }
    
    let response = if errors.is_empty() {
        serde_json::json!({
            "accepted": true,
            "jobs_created": jobs_created,
            "positions_found": positions_count
        })
    } else {
        serde_json::json!({
            "accepted": true,
            "jobs_created": jobs_created,
            "positions_found": positions_count,
            "errors": errors
        })
    };
    
    Ok(Json(response))
}

// ---------- Trade Event Handlers

pub async fn post_leader_trade(
    headers: HeaderMap,
    State(db): State<Database>,
    Json(evt): Json<LeaderTradeEvent>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Validate event using the new validation method
    if let Err(validation_error) = evt.validate() {
        return Err(ApiError::Validation(validation_error));
    }
    
    // Validate market source exists
    if !db.validate_market_source_exists(&evt.market_source_id).await? {
        return Err(ApiError::Validation(format!("Market source {} does not exist", evt.market_source_id)));
    }
    
    // Check idempotency
    let key = idempotency_key_from(&headers).unwrap_or_else(|| evt.idempotency_key.clone());
    
    if !db.insert_idempotency(&key).await? {
        return Err(ApiError::Conflict);
    }
    
    // Process leader trade with proper transaction handling
    let count = db.process_leader_trade(&evt).await?;
    
    Ok(Json(serde_json::json!({
        "accepted": true,
        "replicationsQueued": count
    })))
}

// ---------- Job Handlers

pub async fn get_jobs(
    State(db): State<Database>,
    Query(_q): Query<JobsQuery>,
) -> Result<Json<Vec<ReplicationJob>>, ApiError> {
    let jobs = db.get_pending_jobs().await?;
    Ok(Json(jobs))
}

pub async fn post_job_complete(
    Path(job_id): Path<String>,
    State(db): State<Database>,
    Json(done): Json<ReplicationComplete>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Get job details
    let job = db.get_job(&job_id).await?;
    
    // Complete the job
    db.complete_job(&job_id, &done).await?;
    
    // Create order record
    db.create_order(
        &job.user_id,
        &job.leader_id,
        &job.market_source_id,
        &job.side,
        job.size_usdc,
        &done.status,
        done.filled_usdc,
        done.avg_price,
    ).await?;
    
    // Update position if filled
    if matches!(done.status.as_str(), "filled" | "partial") {
        let filled = done.filled_usdc.unwrap_or(job.size_usdc);
        let price = done.avg_price.unwrap_or(0.0);
        
        // Get existing position if any
        if let Some(pos) = db.get_position(&job.user_id, &job.market_source_id, &job.side).await? {
            // Dollar-cost average
            let new_notional = pos.size_usdc + filled;
            let avg = if new_notional > 0.0 {
                (pos.avg_price * pos.size_usdc + price * filled) / new_notional
            } else {
                pos.avg_price
            };
            
            db.upsert_position(&job.user_id, &job.market_source_id, &job.side, new_notional, avg).await?;
        } else {
            // New position
            db.upsert_position(&job.user_id, &job.market_source_id, &job.side, filled, price).await?;
        }
    }
    
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ---------- Portfolio Handlers

pub async fn get_positions(
    auth: AuthUser,
    State(db): State<Database>,
) -> Result<Json<Vec<Position>>, ApiError> {
    let user_id = &auth.user_id;
    let positions = db.get_user_positions(user_id).await?;
    Ok(Json(positions))
}

pub async fn get_orders(
    auth: AuthUser,
    State(db): State<Database>,
) -> Result<Json<Vec<Order>>, ApiError> {
    let user_id = &auth.user_id;
    let orders = db.get_user_orders(user_id).await?;
    Ok(Json(orders))
}

// ---------- Market Data Handlers

pub async fn get_events(
    State(db): State<Database>,
    Query(query): Query<EventsQuery>,
) -> Result<Json<Vec<AggregatedEvent>>, ApiError> {
    let events = db.get_events(&query).await?;
    Ok(Json(events))
}

pub async fn get_event(
    Path(event_fingerprint): Path<String>,
    State(db): State<Database>,
) -> Result<Json<AggregatedEvent>, ApiError> {
    let event = db.get_event(&event_fingerprint).await?;
    Ok(Json(event))
}

pub async fn get_markets(
    State(db): State<Database>,
    Query(query): Query<MarketsQuery>,
) -> Result<Json<Vec<MarketData>>, ApiError> {
    let markets = db.get_markets(&query).await?;
    Ok(Json(markets))
}

pub async fn get_market_source(
    Path(market_source_id): Path<Uuid>,
    State(db): State<Database>,
) -> Result<Json<MarketSource>, ApiError> {
    // Validate market source exists first
    if !db.validate_market_source_exists(&market_source_id).await? {
        return Err(ApiError::NotFound);
    }
    
    let market = db.get_market_source(&market_source_id).await?;
    Ok(Json(market))
}

pub async fn get_price_history(
    Path(market_source_id): Path<Uuid>,
    State(db): State<Database>,
    Query(query): Query<PriceHistoryQuery>,
) -> Result<Json<Vec<PriceHistoryEntry>>, ApiError> {
    // Validate market source exists first
    if !db.validate_market_source_exists(&market_source_id).await? {
        return Err(ApiError::NotFound);
    }
    
    let mut price_query = query;
    price_query.market_source_id = market_source_id;
    let history = db.get_price_history(&price_query).await?;
    Ok(Json(history))
}

pub async fn get_price_trends(
    Path(market_source_id): Path<Uuid>,
    State(db): State<Database>,
) -> Result<Json<Vec<PriceTrend>>, ApiError> {
    // Validate market source exists first
    if !db.validate_market_source_exists(&market_source_id).await? {
        return Err(ApiError::NotFound);
    }
    
    let trends = db.get_price_trends(&market_source_id).await?;
    Ok(Json(trends))
}

// ---------- Maintenance Handlers

pub async fn cleanup_idempotency_keys(
    State(db): State<Database>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let deleted_count = db.cleanup_old_idempotency_keys(7).await?; // Clean up keys older than 7 days
    
    Ok(Json(serde_json::json!({
        "deleted_keys": deleted_count,
        "message": "Idempotency keys cleanup completed"
    })))
}
