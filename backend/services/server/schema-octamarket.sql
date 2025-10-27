-- Octamarket Trading Server Database Schema
-- This database handles user trading, wallets, orders, positions, and copy trading
-- It reads from the indexer database for market data

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== User Management ====================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User wallets table - connect user accounts to blockchain wallets
CREATE TABLE IF NOT EXISTS user_wallets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    wallet_address TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_platform ON user_wallets(platform);
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_address ON user_wallets(wallet_address);

-- ==================== Market Aggregation Cache ====================

-- Best prices cache - stores best prices across platforms for quick access
CREATE TABLE IF NOT EXISTS best_prices_cache (
    event_fingerprint TEXT PRIMARY KEY,
    event_title TEXT NOT NULL,
    best_yes_price NUMERIC,
    best_yes_platform TEXT,
    best_yes_market_id TEXT,
    best_no_price NUMERIC,
    best_no_platform TEXT,
    best_no_market_id TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_best_prices_last_updated ON best_prices_cache(last_updated);

-- ==================== Arbitrage Detection ====================

-- Arbitrage opportunities table
CREATE TABLE IF NOT EXISTS arbitrage_alerts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_fingerprint TEXT NOT NULL,
    event_title TEXT NOT NULL,
    opportunity_type TEXT NOT NULL, -- 'cross_platform', 'same_platform'
    profit_pct NUMERIC NOT NULL,
    profit_amount_usd NUMERIC,
    buy_platform TEXT NOT NULL,
    buy_market_id TEXT NOT NULL,
    buy_outcome TEXT NOT NULL,
    buy_price NUMERIC NOT NULL,
    sell_platform TEXT NOT NULL,
    sell_market_id TEXT NOT NULL,
    sell_outcome TEXT NOT NULL,
    sell_price NUMERIC NOT NULL,
    min_capital_required NUMERIC,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active', -- 'active', 'executed', 'expired', 'cancelled'
    executed_by VARCHAR(255),
    executed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_arbitrage_status ON arbitrage_alerts(status);
CREATE INDEX IF NOT EXISTS idx_arbitrage_profit_pct ON arbitrage_alerts(profit_pct DESC);
CREATE INDEX IF NOT EXISTS idx_arbitrage_detected_at ON arbitrage_alerts(detected_at DESC);

-- ==================== Order Management ====================

-- User orders table - all orders placed by users
CREATE TABLE IF NOT EXISTS user_orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
    platform TEXT NOT NULL,
    market_id TEXT NOT NULL,
    event_fingerprint TEXT,
    side TEXT NOT NULL, -- 'buy' or 'sell'
    outcome TEXT NOT NULL,
    outcome_index INTEGER,
    price NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    order_type TEXT NOT NULL, -- 'market', 'limit'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'submitted', 'filled', 'partial', 'cancelled', 'failed'
    filled_amount NUMERIC DEFAULT 0,
    avg_fill_price NUMERIC,
    tx_hash TEXT,
    venue_order_id TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_orders_user_id ON user_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orders_status ON user_orders(status);
CREATE INDEX IF NOT EXISTS idx_user_orders_platform ON user_orders(platform);
CREATE INDEX IF NOT EXISTS idx_user_orders_created_at ON user_orders(created_at DESC);

-- ==================== Position Management ====================

-- User positions table
CREATE TABLE IF NOT EXISTS user_positions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
    platform TEXT NOT NULL,
    market_id TEXT NOT NULL,
    event_fingerprint TEXT,
    outcome TEXT NOT NULL,
    outcome_index INTEGER,
    side TEXT NOT NULL, -- 'long' or 'short'
    quantity NUMERIC NOT NULL DEFAULT 0,
    avg_entry_price NUMERIC NOT NULL,
    current_price NUMERIC,
    unrealized_pnl NUMERIC DEFAULT 0,
    realized_pnl NUMERIC DEFAULT 0,
    total_cost NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform, market_id, outcome, side)
);

CREATE INDEX IF NOT EXISTS idx_user_positions_user_id ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_platform ON user_positions(platform);
CREATE INDEX IF NOT EXISTS idx_user_positions_market_id ON user_positions(market_id);

-- ==================== Copy Trading ====================

-- Leaders table - links to tracked_wallets in indexer DB
CREATE TABLE IF NOT EXISTS leaders (
    leader_id VARCHAR(50) PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    followers_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leaders_wallet_address ON leaders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_leaders_is_active ON leaders(is_active);

-- Leader stats cache (synced from indexer DB wallet_stats)
CREATE TABLE IF NOT EXISTS leader_stats (
    leader_id VARCHAR(50) PRIMARY KEY REFERENCES leaders(leader_id) ON DELETE CASCADE,
    total_trades INTEGER DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    total_volume NUMERIC DEFAULT 0,
    pnl_7d NUMERIC DEFAULT 0,
    pnl_30d NUMERIC DEFAULT 0,
    pnl_all_time NUMERIC DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    avg_position_size NUMERIC DEFAULT 0,
    largest_win NUMERIC DEFAULT 0,
    largest_loss NUMERIC DEFAULT 0,
    sharpe_ratio NUMERIC,
    last_trade_at TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leader markets table
CREATE TABLE IF NOT EXISTS leader_markets (
    id SERIAL PRIMARY KEY,
    leader_id VARCHAR(50) NOT NULL REFERENCES leaders(leader_id) ON DELETE CASCADE,
    market_id VARCHAR(255) NOT NULL,
    platform TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(leader_id, market_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_leader_markets_leader_id ON leader_markets(leader_id);

-- Follows table - user following leader
CREATE TABLE IF NOT EXISTS follows (
    follow_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
    leader_id VARCHAR(50) NOT NULL REFERENCES leaders(leader_id),
    base_allocation_usdc DOUBLE PRECISION NOT NULL,
    max_utilization_pct DOUBLE PRECISION NOT NULL,
    max_per_trade_pct DOUBLE PRECISION NOT NULL,
    slippage_bps INTEGER NOT NULL,
    auto_close_with_leader BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'stopped'
    utilized_usdc DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_pnl DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, leader_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_user_id ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_leader_id ON follows(leader_id);
CREATE INDEX IF NOT EXISTS idx_follows_status ON follows(status);

-- ==================== Trade Replication ====================

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
    outcome TEXT NOT NULL,
    size_usdc DOUBLE PRECISION NOT NULL,
    slippage_bps INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'filled', 'partial', 'skipped', 'failed'
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

-- ==================== Activity & History ====================

-- User activity log
CREATE TABLE IF NOT EXISTS user_activity (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
    activity_type TEXT NOT NULL, -- 'order_placed', 'follow_leader', 'wallet_connected', etc.
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

-- ==================== Views ====================

-- Active arbitrage opportunities view
CREATE OR REPLACE VIEW active_arbitrage_opportunities AS
SELECT *
FROM arbitrage_alerts
WHERE status = 'active' 
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY profit_pct DESC;

-- User portfolio summary view
CREATE OR REPLACE VIEW user_portfolio_summary AS
SELECT 
    user_id,
    COUNT(DISTINCT id) as total_positions,
    SUM(total_cost) as total_invested,
    SUM(unrealized_pnl) as total_unrealized_pnl,
    SUM(realized_pnl) as total_realized_pnl,
    SUM(unrealized_pnl + realized_pnl) as total_pnl
FROM user_positions
GROUP BY user_id;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;


