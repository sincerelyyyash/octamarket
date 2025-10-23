-- Copy Trading Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Leaders table
CREATE TABLE IF NOT EXISTS leaders (
    leader_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pnl7d DOUBLE PRECISION NOT NULL DEFAULT 0,
    followers INTEGER NOT NULL DEFAULT 0,
    is_live BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leader stats table
CREATE TABLE IF NOT EXISTS leader_stats (
    leader_id VARCHAR(50) PRIMARY KEY REFERENCES leaders(leader_id) ON DELETE CASCADE,
    pnl7d DOUBLE PRECISION NOT NULL DEFAULT 0,
    pnl30d DOUBLE PRECISION NOT NULL DEFAULT 0,
    win_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leader markets table
CREATE TABLE IF NOT EXISTS leader_markets (
    id SERIAL PRIMARY KEY,
    leader_id VARCHAR(50) NOT NULL REFERENCES leaders(leader_id) ON DELETE CASCADE,
    market_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(leader_id, market_id)
);

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
    follow_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    leader_id VARCHAR(50) NOT NULL REFERENCES leaders(leader_id),
    base_allocation_usdc DOUBLE PRECISION NOT NULL,
    max_utilization_pct DOUBLE PRECISION NOT NULL,
    max_per_trade_pct DOUBLE PRECISION NOT NULL,
    slippage_bps INTEGER NOT NULL,
    auto_close_with_leader BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    utilized_usdc DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_follows_user_id ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_leader_id ON follows(leader_id);
CREATE INDEX IF NOT EXISTS idx_follows_status ON follows(status);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Replication jobs table
CREATE TABLE IF NOT EXISTS replication_jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    follow_id VARCHAR(50) NOT NULL REFERENCES follows(follow_id),
    user_id VARCHAR(255) NOT NULL,
    leader_id VARCHAR(50) NOT NULL,
    venue VARCHAR(50) NOT NULL,
    market_id VARCHAR(255) NOT NULL,
    side VARCHAR(10) NOT NULL,
    size_usdc DOUBLE PRECISION NOT NULL,
    slippage_bps INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    filled_usdc DOUBLE PRECISION,
    avg_price DOUBLE PRECISION,
    venue_order_id VARCHAR(255),
    tx_hash VARCHAR(255),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_replication_jobs_status ON replication_jobs(status);
CREATE INDEX IF NOT EXISTS idx_replication_jobs_user_id ON replication_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_replication_jobs_created_at ON replication_jobs(created_at);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    leader_id VARCHAR(50) NOT NULL,
    market_id VARCHAR(255) NOT NULL,
    side VARCHAR(10) NOT NULL,
    size_usdc DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL,
    filled_usdc DOUBLE PRECISION,
    avg_price DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    market_id VARCHAR(255) NOT NULL,
    side VARCHAR(10) NOT NULL,
    size_usdc DOUBLE PRECISION NOT NULL,
    avg_price DOUBLE PRECISION NOT NULL,
    unrealized DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, market_id, side)
);

CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);

