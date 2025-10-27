use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

use crate::errors::ApiError;

static JWT_SECRET: OnceLock<String> = OnceLock::new();

pub fn init_jwt_secret(secret: String) {
    JWT_SECRET.set(secret).expect("JWT secret already initialized");
}

fn get_jwt_secret() -> &'static str {
    JWT_SECRET.get().expect("JWT secret not initialized")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // user_id
    pub exp: usize,   // expiration timestamp
    pub iat: usize,   // issued at timestamp
}

#[derive(Debug)]
pub struct AuthUser {
    pub user_id: String,
}

pub fn create_token(user_id: &str) -> Result<String, ApiError> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        exp: now + 86400 * 7, // 7 days
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(get_jwt_secret().as_ref()),
    )
    .map_err(|e| {
        tracing::error!("Failed to create token: {:?}", e);
        ApiError::Internal("Failed to create token".to_string())
    })
}

pub fn verify_token(token: &str) -> Result<Claims, ApiError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(get_jwt_secret().as_ref()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| {
        tracing::warn!("Token verification failed: {:?}", e);
        ApiError::Unauthorized
    })
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "Missing authorization header".to_string()))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid authorization format".to_string()))?;

        let claims = verify_token(token)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid or expired token".to_string()))?;

        Ok(AuthUser {
            user_id: claims.sub,
        })
    }
}

pub fn hash_password(password: &str) -> Result<String, ApiError> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST)
        .map_err(|e| {
            tracing::error!("Failed to hash password: {:?}", e);
            ApiError::Internal("Failed to hash password".to_string())
        })
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, ApiError> {
    bcrypt::verify(password, hash)
        .map_err(|e| {
            tracing::error!("Failed to verify password: {:?}", e);
            ApiError::Internal("Failed to verify password".to_string())
        })
}
