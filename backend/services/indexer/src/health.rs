use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub status: String,
    pub timestamp: String,
    pub uptime_seconds: u64,
    pub database_connected: bool,
    pub sources_status: std::collections::HashMap<String, SourceHealth>,
    pub metrics: SystemMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceHealth {
    pub name: String,
    pub status: String,
    pub last_success: Option<String>,
    pub last_error: Option<String>,
    pub error_count: u32,
    pub success_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub events_processed: u64,
    pub events_failed: u64,
    pub price_updates: u64,
    pub database_operations: u64,
    pub memory_usage_mb: f64,
    pub cpu_usage_percent: f64,
}

#[derive(Clone)]
pub struct HealthMonitor {
    start_time: Instant,
    database_connected: Arc<RwLock<bool>>,
    sources_status: Arc<RwLock<std::collections::HashMap<String, SourceHealth>>>,
    metrics: Arc<RwLock<SystemMetrics>>,
}

impl HealthMonitor {
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            database_connected: Arc::new(RwLock::new(false)),
            sources_status: Arc::new(RwLock::new(std::collections::HashMap::new())),
            metrics: Arc::new(RwLock::new(SystemMetrics {
                events_processed: 0,
                events_failed: 0,
                price_updates: 0,
                database_operations: 0,
                memory_usage_mb: 0.0,
                cpu_usage_percent: 0.0,
            })),
        }
    }

    pub async fn set_database_status(&self, connected: bool) {
        let mut status = self.database_connected.write().await;
        *status = connected;
        
        if connected {
            info!("Database connection established");
        } else {
            warn!("Database connection lost");
        }
    }

    pub async fn update_source_status(&self, source_name: &str, success: bool, error: Option<String>) {
        let mut sources = self.sources_status.write().await;
        let source_health = sources.entry(source_name.to_string()).or_insert_with(|| SourceHealth {
            name: source_name.to_string(),
            status: "unknown".to_string(),
            last_success: None,
            last_error: None,
            error_count: 0,
            success_count: 0,
        });

        if success {
            source_health.status = "healthy".to_string();
            source_health.last_success = Some(chrono::Utc::now().to_rfc3339());
            source_health.success_count += 1;
            source_health.last_error = None;
        } else {
            source_health.status = "unhealthy".to_string();
            source_health.last_error = error;
            source_health.error_count += 1;
        }
    }

    pub async fn increment_events_processed(&self) {
        let mut metrics = self.metrics.write().await;
        metrics.events_processed += 1;
    }

    pub async fn increment_events_failed(&self) {
        let mut metrics = self.metrics.write().await;
        metrics.events_failed += 1;
    }

    pub async fn increment_price_updates(&self) {
        let mut metrics = self.metrics.write().await;
        metrics.price_updates += 1;
    }

    pub async fn increment_database_operations(&self) {
        let mut metrics = self.metrics.write().await;
        metrics.database_operations += 1;
    }

    pub async fn update_system_metrics(&self) {
        let mut metrics = self.metrics.write().await;
        
        // Get memory usage (simplified)
        metrics.memory_usage_mb = self.get_memory_usage();
        
        // Get CPU usage (simplified)
        metrics.cpu_usage_percent = self.get_cpu_usage();
    }

    fn get_memory_usage(&self) -> f64 {
        // Simplified memory usage calculation
        // In a real implementation, you'd use system APIs
        0.0
    }

    fn get_cpu_usage(&self) -> f64 {
        // Simplified CPU usage calculation
        // In a real implementation, you'd use system APIs
        0.0
    }

    pub async fn get_health_status(&self) -> HealthStatus {
        let database_connected = *self.database_connected.read().await;
        let sources_status = self.sources_status.read().await.clone();
        let metrics = self.metrics.read().await.clone();

        let overall_status = if database_connected && sources_status.values().all(|s| s.status == "healthy") {
            "healthy"
        } else {
            "degraded"
        };

        HealthStatus {
            status: overall_status.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            uptime_seconds: self.start_time.elapsed().as_secs(),
            database_connected,
            sources_status,
            metrics,
        }
    }

    pub async fn start_monitoring(&self) {
        let monitor = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                monitor.update_system_metrics().await;
                
                let health = monitor.get_health_status().await;
                if health.status == "degraded" {
                    warn!("System health is degraded: {:?}", health);
                }
            }
        });
    }
}

impl Default for HealthMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_monitor() {
        let monitor = HealthMonitor::new();
        
        monitor.set_database_status(true).await;
        monitor.update_source_status("polymarket", true, None).await;
        
        let health = monitor.get_health_status().await;
        assert_eq!(health.status, "healthy");
        assert!(health.database_connected);
    }
}
