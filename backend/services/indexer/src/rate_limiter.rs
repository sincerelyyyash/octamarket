use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tracing::{warn, debug};

#[derive(Clone)]
pub struct RateLimiter {
    max_requests: u32,
    window_duration: Duration,
    requests: Arc<Mutex<Vec<Instant>>>,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_duration: Duration) -> Self {
        Self {
            max_requests,
            window_duration,
            requests: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn acquire(&self) -> bool {
        let mut requests = self.requests.lock().await;
        let now = Instant::now();
        
        // Remove requests outside the window
        requests.retain(|&time| now.duration_since(time) < self.window_duration);
        
        if requests.len() < self.max_requests as usize {
            requests.push(now);
            debug!("Rate limiter: {} requests in window", requests.len());
            true
        } else {
            warn!("Rate limit exceeded: {} requests in {}ms window", 
                  requests.len(), 
                  self.window_duration.as_millis());
            false
        }
    }

    pub async fn wait_for_capacity(&self) {
        loop {
            if self.acquire().await {
                break;
            }
            
            // Wait a bit before trying again
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter() {
        let limiter = RateLimiter::new(2, Duration::from_secs(1));
        
        assert!(limiter.acquire().await);
        assert!(limiter.acquire().await);
        assert!(!limiter.acquire().await);
        
        tokio::time::sleep(Duration::from_millis(1100)).await;
        assert!(limiter.acquire().await);
    }
}
