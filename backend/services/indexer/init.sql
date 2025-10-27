-- Opinion Markets Indexer Database Schema
-- This file initializes the database schema for the indexer service

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Aggregated events table
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

-- Market sources for each aggregated event
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

-- Price history table for tracking price changes over time
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_aggregated_events_fingerprint ON aggregated_events(event_fingerprint);
CREATE INDEX IF NOT EXISTS idx_aggregated_events_status ON aggregated_events(status);
CREATE INDEX IF NOT EXISTS idx_market_sources_event_id ON market_sources(aggregated_event_id);
CREATE INDEX IF NOT EXISTS idx_market_sources_source ON market_sources(source);
CREATE INDEX IF NOT EXISTS idx_market_sources_market_id ON market_sources(market_id);
CREATE INDEX IF NOT EXISTS idx_price_history_market_source ON price_history(market_source_id);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_history_outcome ON price_history(outcome_index, outcome_name);

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

-- Insert some sample data for testing
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

-- Tracked wallets table for monitoring trader addresses
CREATE TABLE IF NOT EXISTS tracked_wallets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address text NOT NULL UNIQUE,
    platform text NOT NULL,
    nickname text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_wallets_platform ON tracked_wallets(platform);
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_is_active ON tracked_wallets(is_active);

-- Wallet trades table for storing individual trades from tracked wallets
CREATE TABLE IF NOT EXISTS wallet_trades (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id uuid NOT NULL REFERENCES tracked_wallets(id) ON DELETE CASCADE,
    platform text NOT NULL,
    market_id text NOT NULL,
    side text NOT NULL,
    outcome_index integer,
    outcome_name text,
    price numeric NOT NULL,
    amount numeric NOT NULL,
    tx_hash text,
    timestamp timestamptz NOT NULL,
    raw_data jsonb,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_trades_wallet_id ON wallet_trades(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_trades_platform ON wallet_trades(platform);
CREATE INDEX IF NOT EXISTS idx_wallet_trades_market_id ON wallet_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_wallet_trades_timestamp ON wallet_trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_wallet_trades_tx_hash ON wallet_trades(tx_hash);

-- Wallet performance stats table
CREATE TABLE IF NOT EXISTS wallet_stats (
    wallet_id uuid PRIMARY KEY REFERENCES tracked_wallets(id) ON DELETE CASCADE,
    total_trades integer NOT NULL DEFAULT 0,
    win_count integer NOT NULL DEFAULT 0,
    loss_count integer NOT NULL DEFAULT 0,
    total_volume numeric NOT NULL DEFAULT 0,
    pnl_7d numeric NOT NULL DEFAULT 0,
    pnl_30d numeric NOT NULL DEFAULT 0,
    pnl_all_time numeric NOT NULL DEFAULT 0,
    win_rate numeric NOT NULL DEFAULT 0,
    avg_position_size numeric NOT NULL DEFAULT 0,
    largest_win numeric NOT NULL DEFAULT 0,
    largest_loss numeric NOT NULL DEFAULT 0,
    sharpe_ratio numeric,
    last_trade_at timestamptz,
    last_updated timestamptz NOT NULL DEFAULT NOW()
);

-- View for easy querying of wallet performance
CREATE OR REPLACE VIEW wallet_leaderboard AS
SELECT 
    tw.id as wallet_id,
    tw.wallet_address,
    tw.platform,
    tw.nickname,
    ws.total_trades,
    ws.win_count,
    ws.loss_count,
    ws.total_volume,
    ws.pnl_7d,
    ws.pnl_30d,
    ws.pnl_all_time,
    ws.win_rate,
    ws.avg_position_size,
    ws.last_trade_at,
    ws.last_updated
FROM tracked_wallets tw
JOIN wallet_stats ws ON tw.id = ws.wallet_id
WHERE tw.is_active = true
ORDER BY ws.pnl_30d DESC;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;
