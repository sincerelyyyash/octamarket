use std::time::Duration;
use tracing::{warn, error, debug};

pub struct RetryConfig {
    pub max_attempts: u32,
    pub base_delay: Duration,
    pub max_delay: Duration,
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(30),
            backoff_multiplier: 2.0,
        }
    }
}

pub async fn with_retry<F, T, E>(
    operation: F,
    config: RetryConfig,
    operation_name: &str,
) -> Result<T, E>
where
    F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>>,
    E: std::fmt::Display,
{
    let mut attempt = 1;
    let mut delay = config.base_delay;

    loop {
        debug!("Attempting {} (attempt {}/{})", operation_name, attempt, config.max_attempts);
        
        match operation().await {
            Ok(result) => {
                debug!("{} succeeded on attempt {}", operation_name, attempt);
                return Ok(result);
            }
            Err(e) => {
                if attempt >= config.max_attempts {
                    error!("{} failed after {} attempts: {}", operation_name, config.max_attempts, e);
                    return Err(e);
                }
                
                warn!("{} failed on attempt {}: {}. Retrying in {:?}", 
                      operation_name, attempt, e, delay);
                
                tokio::time::sleep(delay).await;
                
                attempt += 1;
                delay = std::cmp::min(
                    Duration::from_millis((delay.as_millis() as f64 * config.backoff_multiplier) as u64),
                    config.max_delay,
                );
            }
        }
    }
}

pub async fn with_retry_async<F, Fut, T, E>(
    operation: F,
    config: RetryConfig,
    operation_name: &str,
) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut attempt = 1;
    let mut delay = config.base_delay;

    loop {
        debug!("Attempting {} (attempt {}/{})", operation_name, attempt, config.max_attempts);
        
        match operation().await {
            Ok(result) => {
                debug!("{} succeeded on attempt {}", operation_name, attempt);
                return Ok(result);
            }
            Err(e) => {
                if attempt >= config.max_attempts {
                    error!("{} failed after {} attempts: {}", operation_name, config.max_attempts, e);
                    return Err(e);
                }
                
                warn!("{} failed on attempt {}: {}. Retrying in {:?}", 
                      operation_name, attempt, e, delay);
                
                tokio::time::sleep(delay).await;
                
                attempt += 1;
                delay = std::cmp::min(
                    Duration::from_millis((delay.as_millis() as f64 * config.backoff_multiplier) as u64),
                    config.max_delay,
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    #[tokio::test]
    async fn test_retry_success() {
        let counter = AtomicU32::new(0);
        let config = RetryConfig {
            max_attempts: 3,
            base_delay: Duration::from_millis(10),
            max_delay: Duration::from_secs(1),
            backoff_multiplier: 2.0,
        };

        let result = with_retry_async(
            || async {
                let count = counter.fetch_add(1, Ordering::SeqCst);
                if count < 2 {
                    Err("Not ready yet")
                } else {
                    Ok("Success")
                }
            },
            config,
            "test_operation",
        ).await;

        assert_eq!(result, Ok("Success"));
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn test_retry_failure() {
        let config = RetryConfig {
            max_attempts: 2,
            base_delay: Duration::from_millis(10),
            max_delay: Duration::from_secs(1),
            backoff_multiplier: 2.0,
        };

        let result = with_retry_async(
            || async { Err::<&str, &str>("Always fails") },
            config,
            "test_operation",
        ).await;

        assert!(result.is_err());
    }
}
