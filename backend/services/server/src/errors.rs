use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("unauthorized")]
    Unauthorized,
    
    #[error("validation error: {0}")]
    Validation(String),
    
    #[error("conflict")]
    Conflict,
    
    #[error("not found")]
    NotFound,
    
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("internal server error: {0}")]
    Internal(String),
    
    #[error("forbidden")]
    Forbidden,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (code, message) = match self {
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            ApiError::Validation(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            ApiError::Conflict => (StatusCode::CONFLICT, self.to_string()),
            ApiError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            ApiError::Database(ref e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
            }
            ApiError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            ApiError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
        };
        
        let body = Json(serde_json::json!({
            "error": message
        }));
        
        (code, body).into_response()
    }
}

