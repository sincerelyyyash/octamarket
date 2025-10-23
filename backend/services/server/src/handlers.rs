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

pub async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
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
    Json(_body): Json<CloseAllReq>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Verify ownership
    let follow = db.get_follow(&follow_id).await?;
    if follow.user_id != auth.user_id {
        return Err(ApiError::Forbidden);
    }
    
    // MVP: pretend we enqueued close jobs
    Ok(Json(serde_json::json!({ "accepted": true })))
}

// ---------- Trade Event Handlers

pub async fn post_leader_trade(
    headers: HeaderMap,
    State(db): State<Database>,
    Json(evt): Json<LeaderTradeEvent>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Validate event
    if evt.notional_usdc <= 0.0 {
        return Err(ApiError::Validation("notionalUsdc must be positive".to_string()));
    }
    
    if !matches!(evt.side.as_str(), "buy" | "sell") {
        return Err(ApiError::Validation("side must be 'buy' or 'sell'".to_string()));
    }
    
    // Check idempotency
    let key = idempotency_key_from(&headers).unwrap_or_else(|| evt.idempotency_key.clone());
    
    if !db.insert_idempotency(&key).await? {
        return Err(ApiError::Conflict);
    }
    
    // Get active followers
    let follows = db.get_active_follows_for_leader(&evt.leader_id).await?;
    
    let mut count = 0;
    
    for follow in follows {
        let cap_total = follow.base_allocation_usdc * follow.max_utilization_pct;
        let remaining = (cap_total - follow.utilized_usdc).max(0.0);
        let cap_trade = follow.base_allocation_usdc * follow.max_per_trade_pct;
        let size = remaining.min(cap_trade);
        
        if size > 0.0 {
            let job = ReplicationJob {
                job_id: format!("job_{}", Uuid::new_v4().simple()),
                follow_id: follow.follow_id,
                user_id: follow.user_id,
                leader_id: evt.leader_id.clone(),
                venue: evt.venue.clone(),
                market_id: evt.market_id.clone(),
                side: evt.side.clone(),
                size_usdc: size,
                slippage_bps: follow.slippage_bps,
            };
            
            db.create_replication_job(&job).await?;
            count += 1;
        }
    }
    
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
        &job.market_id,
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
        if let Some(pos) = db.get_position(&job.user_id, &job.market_id, &job.side).await? {
            // Dollar-cost average
            let new_notional = pos.size_usdc + filled;
            let avg = if new_notional > 0.0 {
                (pos.avg_price * pos.size_usdc + price * filled) / new_notional
            } else {
                pos.avg_price
            };
            
            db.upsert_position(&job.user_id, &job.market_id, &job.side, new_notional, avg).await?;
        } else {
            // New position
            db.upsert_position(&job.user_id, &job.market_id, &job.side, filled, price).await?;
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
