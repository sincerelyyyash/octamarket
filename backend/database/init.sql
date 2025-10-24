-- Opinion Markets Unified Database Schema
-- This file initializes the complete database schema for both indexer and server services

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- INDEXER SERVICE TABLES (Market Data)
-- ============================================================================

-- Aggregated events table (from Indexer)
CREATE TABLE IF NOT EXISTS aggregated_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_fingerprint text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    end_time timestamptz,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Market sources for each aggregated event (from Indexer)
CREATE TABLE IF NOT EXISTS market_sources (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregated_event_id uuid NOT NULL REFERENCES aggregated_events(id) ON DELETE CASCADE,
    source text NOT NULL,
    market_id text NOT NULL,
    market_slug text,
    name text,
    status text,
    outcomes jsonb,
    prices jsonb,
    traded_amount numeric,
    resolved_outcome text,
    observed_at timestamptz NOT NULL,
    raw_payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Price history table for tracking price changes over time (from Indexer)
CREATE TABLE IF NOT EXISTS price_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_source_id uuid NOT NULL REFERENCES market_sources(id) ON DELETE CASCADE,
    outcome_index integer NOT NULL,
    outcome_name text NOT NULL,
    price numeric NOT NULL,
    volume numeric,
    timestamp timestamptz NOT NULL DEFAULT NOW(),
    source_data jsonb
);

-- ============================================================================
-- SERVER SERVICE TABLES (Copy Trading)
-- ============================================================================

-- Users table (Copy Trading)
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leaders table (Copy Trading)
CREATE TABLE IF NOT EXISTS leaders (
    leader_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pnl7d DOUBLE PRECISION NOT NULL DEFAULT 0,
    followers INTEGER NOT NULL DEFAULT 0,
    is_live BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leader stats table (Copy Trading)
CREATE TABLE IF NOT EXISTS leader_stats (
    leader_id VARCHAR(50) PRIMARY KEY REFERENCES leaders(leader_id) ON DELETE CASCADE,
    pnl7d DOUBLE PRECISION NOT NULL DEFAULT 0,
    pnl30d DOUBLE PRECISION NOT NULL DEFAULT 0,
    win_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leader markets table (Copy Trading)
CREATE TABLE IF NOT EXISTS leader_markets (
    leader_id VARCHAR(50) NOT NULL REFERENCES leaders(leader_id) ON DELETE CASCADE,
    market_source_id uuid NOT NULL REFERENCES market_sources(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (leader_id, market_source_id)
);

-- Follows table (Copy Trading)
CREATE TABLE IF NOT EXISTS follows (
    follow_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    leader_id VARCHAR(50) NOT NULL REFERENCES leaders(leader_id) ON DELETE CASCADE,
    base_allocation_usdc DOUBLE PRECISION NOT NULL,
    max_utilization_pct DOUBLE PRECISION NOT NULL,
    max_per_trade_pct DOUBLE PRECISION NOT NULL,
    slippage_bps INTEGER NOT NULL,
    auto_close_with_leader BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    utilized_usdc DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Idempotency keys table (Copy Trading)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Replication jobs table (Copy Trading)
CREATE TABLE IF NOT EXISTS replication_jobs (
    job_id VARCHAR(255) PRIMARY KEY,
    follow_id VARCHAR(255) NOT NULL REFERENCES follows(follow_id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    leader_id VARCHAR(50) NOT NULL,
    venue VARCHAR(50) NOT NULL,
    market_source_id uuid NOT NULL REFERENCES market_sources(id) ON DELETE CASCADE,
    side VARCHAR(10) NOT NULL,
    size_usdc DOUBLE PRECISION NOT NULL,
    slippage_bps INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table (Copy Trading)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    leader_id VARCHAR(50) NOT NULL,
    market_source_id uuid NOT NULL REFERENCES market_sources(id) ON DELETE CASCADE,
    side VARCHAR(10) NOT NULL,
    size_usdc DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL,
    filled_usdc DOUBLE PRECISION,
    avg_price DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Positions table (Copy Trading)
CREATE TABLE IF NOT EXISTS positions (
    user_id VARCHAR(255) NOT NULL,
    market_source_id uuid NOT NULL REFERENCES market_sources(id) ON DELETE CASCADE,
    side VARCHAR(10) NOT NULL,
    size_usdc DOUBLE PRECISION NOT NULL,
    avg_price DOUBLE PRECISION NOT NULL,
    unrealized DOUBLE PRECISION NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, market_source_id, side)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexer service indexes
CREATE INDEX IF NOT EXISTS idx_aggregated_events_fingerprint ON aggregated_events(event_fingerprint);
CREATE INDEX IF NOT EXISTS idx_aggregated_events_status ON aggregated_events(status);
CREATE INDEX IF NOT EXISTS idx_market_sources_event_id ON market_sources(aggregated_event_id);
CREATE INDEX IF NOT EXISTS idx_market_sources_source ON market_sources(source);
CREATE INDEX IF NOT EXISTS idx_market_sources_market_id ON market_sources(market_id);
CREATE INDEX IF NOT EXISTS idx_price_history_market_source ON price_history(market_source_id);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_history_outcome ON price_history(outcome_index, outcome_name);

-- Server service indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_follows_user_id ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_leader_id ON follows(leader_id);
CREATE INDEX IF NOT EXISTS idx_follows_status ON follows(status);
CREATE INDEX IF NOT EXISTS idx_replication_jobs_status ON replication_jobs(status);
CREATE INDEX IF NOT EXISTS idx_replication_jobs_user_id ON replication_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_replication_jobs_created_at ON replication_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_follows_leader_status ON follows(leader_id, status);
CREATE INDEX IF NOT EXISTS idx_follows_user_status ON follows(user_id, status);
CREATE INDEX IF NOT EXISTS idx_replication_jobs_status_created ON replication_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_positions_user_market ON positions(user_id, market_source_id);

-- ============================================================================
-- CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Constraints to prevent data corruption
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_market_source') THEN
        ALTER TABLE market_sources ADD CONSTRAINT unique_market_source UNIQUE (aggregated_event_id, source, market_id);
    END IF;
END $$;

-- Ensure market_id cannot be empty
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_market_id_not_empty') THEN
        ALTER TABLE market_sources ADD CONSTRAINT check_market_id_not_empty CHECK (length(trim(market_id)) > 0);
    END IF;
END $$;

-- Ensure source is not empty
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_source_not_empty') THEN
        ALTER TABLE market_sources ADD CONSTRAINT check_source_not_empty CHECK (length(trim(source)) > 0);
    END IF;
END $$;

-- Ensure title is not empty
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_title_not_empty') THEN
        ALTER TABLE aggregated_events ADD CONSTRAINT check_title_not_empty CHECK (length(trim(title)) > 0);
    END IF;
END $$;

-- Ensure event_fingerprint is not empty
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_fingerprint_not_empty') THEN
        ALTER TABLE aggregated_events ADD CONSTRAINT check_fingerprint_not_empty CHECK (length(trim(event_fingerprint)) > 0);
    END IF;
END $$;

-- Copy trading constraints
ALTER TABLE follows ADD CONSTRAINT check_max_utilization_pct 
    CHECK (max_utilization_pct >= 0 AND max_utilization_pct <= 1);

ALTER TABLE follows ADD CONSTRAINT check_max_per_trade_pct 
    CHECK (max_per_trade_pct >= 0 AND max_per_trade_pct <= 1);

ALTER TABLE follows ADD CONSTRAINT check_slippage_bps 
    CHECK (slippage_bps >= 0 AND slippage_bps <= 10000);

ALTER TABLE follows ADD CONSTRAINT check_base_allocation_usdc 
    CHECK (base_allocation_usdc > 0 AND base_allocation_usdc <= 1000000);

-- Add foreign key constraint
ALTER TABLE leader_markets ADD CONSTRAINT fk_leader_markets_market_source 
    FOREIGN KEY (market_source_id) REFERENCES market_sources(id) ON DELETE CASCADE;

-- Add unique constraints to prevent duplicates
ALTER TABLE follows ADD CONSTRAINT unique_user_leader 
    UNIQUE (user_id, leader_id) WHERE status = 'active';

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_aggregated_events_updated_at 
    BEFORE UPDATE ON aggregated_events 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================================

-- Create a view for easy querying of current market data
CREATE OR REPLACE VIEW current_market_data AS
SELECT 
    ae.event_fingerprint,
    ae.title as event_title,
    ae.description,
    ae.end_time,
    ae.status as event_status,
    ms.source,
    ms.market_id,
    ms.name as market_name,
    ms.status as market_status,
    ms.outcomes,
    ms.prices,
    ms.traded_amount,
    ms.observed_at,
    ms.created_at as market_created_at
FROM aggregated_events ae
JOIN market_sources ms ON ae.id = ms.aggregated_event_id
WHERE ae.status = 'active'
ORDER BY ae.created_at DESC, ms.observed_at DESC;

-- Create a view for price trends
CREATE OR REPLACE VIEW price_trends AS
SELECT 
    ms.market_id,
    ms.source,
    ph.outcome_name,
    ph.price,
    ph.volume,
    ph.timestamp,
    ae.title as event_title
FROM price_history ph
JOIN market_sources ms ON ph.market_source_id = ms.id
JOIN aggregated_events ae ON ms.aggregated_event_id = ae.id
ORDER BY ph.timestamp DESC;

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert sample aggregated events
INSERT INTO aggregated_events (event_fingerprint, title, description, end_time, status) VALUES
('sample_event_1', 'Will Bitcoin reach $100,000 by end of 2024?', 'Prediction market for Bitcoin price', '2024-12-31 23:59:59+00', 'active'),
('sample_event_2', 'Will the next US President be from a third party?', 'Political prediction market', '2024-11-05 23:59:59+00', 'active')
ON CONFLICT (event_fingerprint) DO NOTHING;

-- Insert sample market sources
INSERT INTO market_sources (aggregated_event_id, source, market_id, name, status, outcomes, prices, observed_at, raw_payload)
SELECT 
    ae.id,
    'polymarket',
    'sample_market_1',
    'Bitcoin $100K Market',
    'active',
    '["Yes", "No"]'::jsonb,
    '[0.65, 0.35]'::jsonb,
    NOW(),
    '{"title": "Bitcoin $100K", "outcomes": ["Yes", "No"], "prices": [0.65, 0.35]}'::jsonb
FROM aggregated_events ae 
WHERE ae.event_fingerprint = 'sample_event_1'
ON CONFLICT (aggregated_event_id, source, market_id) DO NOTHING;

-- Insert sample price history
INSERT INTO price_history (market_source_id, outcome_index, outcome_name, price, volume, timestamp, source_data)
SELECT 
    ms.id,
    0,
    'Yes',
    0.65,
    1000.0,
    NOW() - INTERVAL '1 hour',
    ('{"source": "polymarket", "timestamp": "' || (NOW() - INTERVAL '1 hour')::text || '"}')::jsonb
FROM market_sources ms
JOIN aggregated_events ae ON ms.aggregated_event_id = ae.id
WHERE ae.event_fingerprint = 'sample_event_1'
ON CONFLICT DO NOTHING;

-- Insert sample leaders
INSERT INTO leaders (leader_id, name, pnl7d, followers, is_live) VALUES
('leader_1', 'CryptoTrader', 1250.50, 150, true),
('leader_2', 'PoliticalOracle', 890.25, 75, true),
('leader_3', 'SportsAnalyst', -120.75, 45, false)
ON CONFLICT (leader_id) DO NOTHING;

-- Insert sample leader stats
INSERT INTO leader_stats (leader_id, pnl7d, pnl30d, win_rate) VALUES
('leader_1', 1250.50, 3200.75, 0.78),
('leader_2', 890.25, 2100.50, 0.65),
('leader_3', -120.75, 450.25, 0.42)
ON CONFLICT (leader_id) DO NOTHING;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;
