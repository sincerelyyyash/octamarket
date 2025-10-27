use crate::order_executor::{OrderExecutor, PolymarketExecutor};
use crate::order_executor::executor_trait::OrderExecutionError;
use crate::models::{PlaceOrderRequest, OrderResponse};
use std::collections::HashMap;
use std::sync::Arc;

/// Routes orders to the appropriate platform executor
pub struct OrderRouter {
    executors: HashMap<String, Arc<dyn OrderExecutor>>,
}

impl OrderRouter {
    pub fn new() -> Self {
        Self {
            executors: HashMap::new(),
        }
    }

    /// Register an executor for a platform
    pub fn register_executor(&mut self, executor: Arc<dyn OrderExecutor>) {
        self.executors.insert(executor.platform().to_string(), executor);
    }

    /// Route order to the appropriate platform
    pub async fn route_order(
        &self,
        request: PlaceOrderRequest,
        user_wallet: &str,
    ) -> Result<OrderResponse, OrderExecutionError> {
        let platform = request.platform.as_deref()
            .ok_or_else(|| OrderExecutionError::InvalidRequest("Platform not specified".to_string()))?;
        
        let executor = self.executors.get(platform)
            .ok_or_else(|| OrderExecutionError::InvalidRequest(format!("Platform {} not supported", platform)))?;
        
        executor.place_order(request, user_wallet).await
    }

    /// Cancel order on a specific platform
    pub async fn cancel_order(&self, platform: &str, order_id: &str) -> Result<(), OrderExecutionError> {
        let executor = self.executors.get(platform)
            .ok_or_else(|| OrderExecutionError::InvalidRequest(format!("Platform {} not supported", platform)))?;
        
        executor.cancel_order(order_id).await
    }
}

impl Default for OrderRouter {
    fn default() -> Self {
        let mut router = Self::new();
        
        // Register default executors
        router.register_executor(Arc::new(PolymarketExecutor::new(
            "https://clob.polymarket.com".to_string()
        )));
        
        router
    }
}


