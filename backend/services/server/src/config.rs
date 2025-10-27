use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub indexer_db_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub jwt_secret: String,
    pub allowed_origins: Vec<String>,
    pub polymarket_clob_url: String,
    pub cache_refresh_interval_seconds: u64,
    pub arbitrage_min_profit_pct: f64,
    pub arbitrage_scan_interval_seconds: u64,
}

impl Config {
    pub fn from_env() -> Result<Self, env::VarError> {
        let jwt_secret = env::var("JWT_SECRET")
            .expect("JWT_SECRET must be set in production");
        
        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();
        
        Ok(Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/octamarket".to_string()),
            indexer_db_url: env::var("INDEXER_DB_URL")
                .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/indexer".to_string()),
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            jwt_secret,
            allowed_origins,
            polymarket_clob_url: env::var("POLYMARKET_CLOB_URL")
                .unwrap_or_else(|_| "https://clob.polymarket.com".to_string()),
            cache_refresh_interval_seconds: env::var("CACHE_REFRESH_INTERVAL_SECONDS")
                .unwrap_or_else(|_| "5".to_string())
                .parse()
                .unwrap_or(5),
            arbitrage_min_profit_pct: env::var("ARBITRAGE_MIN_PROFIT_PCT")
                .unwrap_or_else(|_| "0.5".to_string())
                .parse()
                .unwrap_or(0.5),
            arbitrage_scan_interval_seconds: env::var("ARBITRAGE_SCAN_INTERVAL_SECONDS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
        })
    }
    
    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}
