# Octamarket Trading Server - Setup Guide

## Overview

This is the main trading server for the Octamarket prediction market aggregator platform. It provides:

- **Market Aggregation**: Best prices across all platforms
- **Arbitrage Detection**: Automatic scanning for profit opportunities
- **Order Execution**: Place orders on multiple platforms
- **Copy Trading**: Follow top traders
- **Wallet Management**: Connect and manage wallets

## Architecture

### Dual Database System

The server connects to TWO PostgreSQL databases:

1. **Trading Database** (`octamarket`): User data, orders, positions, follows
2. **Indexer Database** (`indexer`): Market data, prices, wallet trades (read-only)

This separation allows the indexer to focus on data collection while the trading server handles user operations.

## Prerequisites

- Rust (latest stable)
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Both databases running (indexer + octamarket)

## Quick Setup

### 1. Start PostgreSQL

From `backend/` directory:

```bash
docker compose up -d postgres
```

### 2. Create Octamarket Database

```bash
docker exec -it backend-postgres-1 psql -U postgres -c "CREATE DATABASE octamarket;"
```

### 3. Run Database Schemas

**Indexer database** (if not already done):
```bash
docker exec -i backend-postgres-1 psql -U postgres -d indexer < services/indexer/init.sql
```

**Trading database**:
```bash
docker exec -i backend-postgres-1 psql -U postgres -d octamarket < services/server/schema-octamarket.sql
```

### 4. Configure Environment

Create `.env` file in `backend/services/server/`:

```env
# Database URLs
DATABASE_URL=postgres://postgres:postgres@localhost:5432/octamarket
INDEXER_DB_URL=postgres://postgres:postgres@localhost:5432/indexer

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# Security  
JWT_SECRET=super-secret-jwt-key-change-this-in-production-min-32-chars

# CORS
ALLOWED_ORIGINS=*

# Polymarket
POLYMARKET_CLOB_URL=https://clob.polymarket.com

# Cache & Arbitrage
CACHE_REFRESH_INTERVAL_SECONDS=5
ARBITRAGE_MIN_PROFIT_PCT=0.5
ARBITRAGE_SCAN_INTERVAL_SECONDS=10

# Logging
RUST_LOG=server=debug,tower_http=debug
```

### 5. Run Server

**Option A: Use new main (recommended)**

Replace `src/main.rs` with `src/main_new.rs`:

```bash
cd backend/services/server
mv src/main.rs src/main_old.rs
cp src/main_new.rs src/main.rs
cargo run
```

**Option B: Keep separate for testing**

```bash
cd backend/services/server  
cargo build
# Manually test new implementation
```

### 6. Update Cargo.toml

Add new dependencies if needed:

```toml
[dependencies]
uuid = { version = "1", features = ["serde", "v4"] }
chrono = { version = "0.4", features = ["serde"] }
# ... existing dependencies
```

## API Endpoints

### Market Aggregation

```
GET /markets
GET /markets/{event_fingerprint}/sources
GET /markets/{event_fingerprint}/best-price
```

### Leaders & Wallets

```
GET /leaders
GET /leaders/{leader_id}
GET /wallet-leaderboard
GET /wallets/{wallet_address}/trades
```

### Arbitrage

```
GET /arbitrage/opportunities
GET /arbitrage/opportunities/{id}
```

### Orders (Protected)

```
POST /orders/place
GET /orders/my
DELETE /orders/{order_id}/cancel
```

### Wallets (Protected)

```
POST /wallets/connect
GET /wallets/my
```

### Copy Trading (Protected)

```
POST /follow
GET /follows/me
POST /unfollow
PATCH /follow/{follow_id}
POST /follow/{follow_id}/pause
POST /follow/{follow_id}/resume
```

## Background Tasks

The server runs two background tasks:

### 1. Best Prices Cache (Every 5 seconds)

- Queries indexer DB for all market prices
- Calculates best prices across platforms
- Updates `best_prices_cache` table

### 2. Arbitrage Scanner (Every 10 seconds)

- Scans all markets for arbitrage opportunities
- Creates alerts in `arbitrage_alerts` table
- Expires old alerts (> 5 minutes)

## Testing

### 1. Health Check

```bash
curl http://localhost:8080/health
```

### 2. Get Markets

```bash
curl http://localhost:8080/markets
```

### 3. Get Wallet Leaderboard

```bash
curl http://localhost:8080/wallet-leaderboard
```

### 4. Register User

```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 5. Place Order (with auth token)

```bash
TOKEN="<your_token>"
curl -X POST http://localhost:8080/orders/place \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "market_id": "some-market-id",
    "platform": "polymarket",
    "side": "buy",
    "outcome": "Yes",
    "price": 0.55,
    "amount": 100,
    "order_type": "limit"
  }'
```

## Module Structure

```
src/
├── main_new.rs              # Main entry point (NEW)
├── config.rs                # Configuration (UPDATED)
├── db_dual.rs               # Dual database connection (NEW)
├── models_new.rs            # New data models (NEW)
├── handlers_new.rs          # New API handlers (NEW)
├── routes_new.rs            # New routes (NEW)
├── aggregator/              # Price aggregation (NEW)
│   ├── price_aggregator.rs
│   ├── best_price_finder.rs
│   └── cache_manager.rs
├── arbitrage/               # Arbitrage detection (NEW)
│   ├── detector.rs
│   ├── analyzer.rs
│   └── alerts.rs
└── order_executor/          # Order execution (NEW)
    ├── executor_trait.rs
    ├── polymarket_executor.rs
    └── router.rs
```

## Troubleshooting

### Database Connection Errors

Make sure both databases exist and are accessible:

```bash
# Check indexer DB
docker exec -it backend-postgres-1 psql -U postgres -d indexer -c "SELECT 1;"

# Check octamarket DB
docker exec -it backend-postgres-1 psql -U postgres -d octamarket -c "SELECT 1;"
```

### No Market Data

Make sure the indexer is running and has collected data:

```bash
cd backend/services/indexer
export POSTGRES_URL=postgres://postgres:postgres@localhost:5432/indexer
cargo run
```

### Build Errors

Make sure all dependencies are in `Cargo.toml` and run:

```bash
cargo clean
cargo build
```

## Production Deployment

1. **Change JWT_SECRET** to a secure random string (min 32 chars)
2. **Set ALLOWED_ORIGINS** to your frontend domain
3. **Use production database URLs**
4. **Build in release mode**: `cargo build --release`
5. **Run binary**: `./target/release/server`
6. **Set up reverse proxy** (nginx/caddy) for HTTPS
7. **Monitor logs** and set up alerts

## Next Steps

### For Full Integration

1. Add remaining copy trading handlers to `handlers_new.rs`
2. Create frontend API client (`frontend/web/src/lib/api/`)
3. Update frontend hooks to use real API
4. Build market aggregator UI
5. Build arbitrage UI  
6. Build order placement UI

### For Production

1. Implement real Polymarket API integration
2. Add signature verification for wallet connections
3. Implement proper error handling and retries
4. Add rate limiting
5. Add metrics and monitoring
6. Add comprehensive tests

## License

[Your License]

## Support

For issues or questions, open an issue on GitHub.


