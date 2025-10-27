use crate::models::{PlaceOrderRequest, OrderResponse};
use async_trait::async_trait;

/// Common interface for order execution across different platforms
#[async_trait]
pub trait OrderExecutor: Send + Sync {
    /// Platform name
    fn platform(&self) -> &'static str;
    
    /// Place an order on the platform
    async fn place_order(&self, request: PlaceOrderRequest, user_wallet: &str) -> Result<OrderResponse, OrderExecutionError>;
    
    /// Cancel an order
    async fn cancel_order(&self, order_id: &str) -> Result<(), OrderExecutionError>;
    
    /// Get order status
    async fn get_order_status(&self, order_id: &str) -> Result<OrderStatus, OrderExecutionError>;
}

#[derive(Debug)]
pub enum OrderExecutionError {
    NetworkError(String),
    InvalidRequest(String),
    InsufficientFunds(String),
    OrderRejected(String),
    Unknown(String),
}

impl std::fmt::Display for OrderExecutionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OrderExecutionError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            OrderExecutionError::InvalidRequest(msg) => write!(f, "Invalid request: {}", msg),
            OrderExecutionError::InsufficientFunds(msg) => write!(f, "Insufficient funds: {}", msg),
            OrderExecutionError::OrderRejected(msg) => write!(f, "Order rejected: {}", msg),
            OrderExecutionError::Unknown(msg) => write!(f, "Unknown error: {}", msg),
        }
    }
}

impl std::error::Error for OrderExecutionError {}

#[derive(Debug, Clone)]
pub struct OrderStatus {
    pub order_id: String,
    pub status: String, // "pending", "filled", "partial", "cancelled", "failed"
    pub filled_amount: Option<f64>,
    pub avg_fill_price: Option<f64>,
}


