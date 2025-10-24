# Opinion Markets Server

A Rust-based API server for copy trading on prediction markets with integrated market data indexing.

## Prerequisites

- Rust (latest stable)
- Docker & Docker Compose
- PostgreSQL (via Docker)

## Quick Setup

### 1. Start Database

```bash
cd backend
docker-compose up -d postgres
```

### 2. Configure Environment

```bash
cp env.example .env
```

Default configuration:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/opinion_markets
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
RUST_LOG=server=debug,tower_http=debug
JWT_SECRET=super-secret-jwt-key-change-this-in-production-min-32-chars
ALLOWED_ORIGINS=*
```

### 3. Run Server

```bash
cargo run
```

Server starts at `http://localhost:8080`

## API Endpoints

### Health

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "database": "connected"
}
```

### Metrics

```
GET /metrics
```

**Response:**
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "database": "connected",
  "users": 150,
  "active_follows": 42,
  "pending_jobs": 3
}
```

---

### Authentication

#### Register

```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1Q...",
  "user_id": "usr_abc123"
}
```

#### Login

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1Q...",
  "user_id": "usr_abc123"
}
```

---

### Leaders (Public)

#### Get All Leaders

```
GET /leaders
```

**Response:**
```json
[
  {
    "leader_id": "leader_1",
    "name": "ProTrader",
    "pnl7d": 15.5,
    "followers": 42,
    "is_live": true
  }
]
```

#### Get Leader Details

```
GET /leaders/{leader_id}
```

**Response:**
```json
{
  "leader_id": "leader_1",
  "name": "ProTrader",
  "stats": {
    "pnl7d": 15.5,
    "pnl30d": 45.2,
    "win_rate": 0.68
  },
  "markets": ["TRUMP-NO-2024", "ETH-PRICE-GT-3000"]
}
```

---

### Follow Management (Protected)

All endpoints require: `Authorization: Bearer <token>`

#### Follow a Leader

```
POST /follow
Authorization: Bearer <token>
Content-Type: application/json

{
  "leader_id": "leader_1",
  "base_allocation_usdc": 1000.0,
  "max_utilization_pct": 0.8,
  "max_per_trade_pct": 0.2,
  "slippage_bps": 50,
  "auto_close_with_leader": true
}
```

**Response:**
```json
{
  "followId": "flw_xyz789",
  "status": "active"
}
```

#### Get User's Follows

```
GET /follows/me
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "follow_id": "flw_xyz789",
    "leader_id": "leader_1",
    "base_allocation_usdc": 1000.0,
    "utilization_now_pct": 0.45,
    "status": "active"
  }
]
```

#### Update Follow Settings

```
PATCH /follow/{follow_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "max_utilization_pct": 0.6,
  "slippage_bps": 75
}
```

#### Pause Follow

```
POST /follow/{follow_id}/pause
Authorization: Bearer <token>
```

#### Resume Follow

```
POST /follow/{follow_id}/resume
Authorization: Bearer <token>
```

#### Unfollow Leader

```
POST /unfollow
Authorization: Bearer <token>
Content-Type: application/json

{
  "leader_id": "leader_1",
  "action": "stop"
}
```

Actions: `"pause"` or `"stop"`

#### Close All Positions

```
POST /follow/{follow_id}/close-all
Authorization: Bearer <token>
Content-Type: application/json

{
  "mode": "market",
  "slippage_bps": 100
}
```

**Response:**
```json
{
  "accepted": true,
  "jobs_created": 3,
  "positions_found": 3
}
```

Creates close jobs for all positions associated with the follow. Each position gets a separate close job that will be processed by the worker service.

---

### Trade Events (System)

#### Report Leader Trade

```
POST /events/leader-trade
Content-Type: application/json
Idempotency-Key: <unique-key>

{
  "idempotency_key": "trade_unique_123",
  "leader_id": "leader_1",
  "venue": "polymarket",
  "market_source_id": "550e8400-e29b-41d4-a716-446655440000",
  "side": "buy",
  "price": 0.55,
  "notional_usdc": 500.0,
  "ts": "2025-10-23T12:00:00Z"
}
```

**Response:**
```json
{
  "accepted": true,
  "replicationsQueued": 3
}
```

---

### Replication Jobs (Worker)

#### Get Pending Jobs

```
GET /jobs/replications
```

**Response:**
```json
[
  {
    "job_id": "job_abc456",
    "follow_id": "flw_xyz789",
    "user_id": "usr_123",
    "leader_id": "leader_1",
    "venue": "polymarket",
    "market_source_id": "550e8400-e29b-41d4-a716-446655440000",
    "side": "buy",
    "size_usdc": 200.0,
    "slippage_bps": 50
  }
]
```

#### Complete Job

```
POST /jobs/replications/{job_id}/complete
Content-Type: application/json

{
  "status": "filled",
  "filled_usdc": 200.0,
  "avg_price": 0.56,
  "venue_order_id": "order_789",
  "tx_hash": "0x123abc...",
  "reason": null
}
```

Status values: `"filled"`, `"partial"`, `"skipped"`, `"failed"`

---

### Market Data (Public)

#### Get All Events

```
GET /events?limit=10&status=active&source=polymarket
```

**Response:**
```json
[
  {
    "id": "uuid",
    "event_fingerprint": "event_123",
    "title": "Will Bitcoin reach $100,000 by end of 2024?",
    "description": "Prediction market for Bitcoin price",
    "end_time": "2024-12-31T23:59:59Z",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Get Event Details

```
GET /events/{event_fingerprint}
```

#### Get Markets

```
GET /markets?event_fingerprint=event_123&source=polymarket&limit=10
```

**Response:**
```json
[
  {
    "event_fingerprint": "event_123",
    "event_title": "Will Bitcoin reach $100,000 by end of 2024?",
    "source": "polymarket",
    "market_id": "market_456",
    "market_name": "Bitcoin $100K Market",
    "outcomes": ["Yes", "No"],
    "prices": [0.65, 0.35],
    "traded_amount": 10000.0,
    "observed_at": "2024-01-01T12:00:00Z"
  }
]
```

#### Get Market Source Details

```
GET /markets/{market_source_id}
```

#### Get Price History

```
GET /markets/{market_source_id}/price-history?limit=100&hours_back=24
```

#### Get Price Trends

```
GET /markets/{market_source_id}/price-trends
```

---

### Maintenance (Protected)

#### Cleanup Idempotency Keys

```
POST /admin/cleanup/idempotency
Authorization: Bearer <token>
```

**Response:**
```json
{
  "deleted_keys": 150,
  "message": "Idempotency keys cleanup completed"
}
```

Removes idempotency keys older than 7 days. This endpoint is also called automatically by a background task that runs daily.

---

### Portfolio (Protected)

#### Get Positions

```
GET /positions
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "market_source_id": "550e8400-e29b-41d4-a716-446655440000",
    "side": "buy",
    "size_usdc": 400.0,
    "avg_price": 0.54,
    "unrealized": 20.5
  }
]
```

#### Get Orders

```
GET /orders
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "order_123",
    "user_id": "usr_123",
    "leader_id": "leader_1",
    "market_source_id": "550e8400-e29b-41d4-a716-446655440000",
    "side": "buy",
    "size_usdc": 200.0,
    "status": "filled",
    "filled_usdc": 200.0,
    "avg_price": 0.56,
    "created_at": "2025-10-23T12:05:00Z"
  }
]
```

---

## Testing with PowerShell

```powershell
# Register & Get Token
$response = Invoke-WebRequest -Uri http://localhost:8080/auth/register `
  -Method POST -Headers @{"Content-Type"="application/json"} `
  -Body '{"email":"test@test.com","password":"test1234"}' | ConvertFrom-Json
$token = $response.token

# Get Leaders
Invoke-WebRequest http://localhost:8080/leaders | ConvertFrom-Json

# Follow a Leader
Invoke-WebRequest -Uri http://localhost:8080/follow -Method POST `
  -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer $token"} `
  -Body '{"leader_id":"leader_1","base_allocation_usdc":1000,"max_utilization_pct":0.8,"max_per_trade_pct":0.2,"slippage_bps":50,"auto_close_with_leader":true}'

# Get Your Follows
Invoke-WebRequest http://localhost:8080/follows/me `
  -Headers @{"Authorization"="Bearer $token"} | ConvertFrom-Json

# Report Leader Trade
Invoke-WebRequest -Uri http://localhost:8080/events/leader-trade -Method POST `
  -Headers @{"Content-Type"="application/json"; "Idempotency-Key"="trade_123"} `
  -Body '{"idempotency_key":"trade_123","leader_id":"leader_1","venue":"polymarket","market_source_id":"550e8400-e29b-41d4-a716-446655440000","side":"buy","price":0.55,"notional_usdc":500,"ts":"2025-10-23T12:00:00Z"}'

# Get Pending Jobs
Invoke-WebRequest http://localhost:8080/jobs/replications | ConvertFrom-Json

# Get Positions
Invoke-WebRequest http://localhost:8080/positions `
  -Headers @{"Authorization"="Bearer $token"} | ConvertFrom-Json
```

## Testing with curl (Linux/Mac)

```bash
# Register & Get Token
TOKEN=$(curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}' | jq -r .token)

# Get Leaders
curl http://localhost:8080/leaders | jq

# Follow a Leader
curl -X POST http://localhost:8080/follow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"leader_id":"leader_1","base_allocation_usdc":1000,"max_utilization_pct":0.8,"max_per_trade_pct":0.2,"slippage_bps":50,"auto_close_with_leader":true}'

# Get Your Follows
curl http://localhost:8080/follows/me \
  -H "Authorization: Bearer $TOKEN" | jq

# Get Positions
curl http://localhost:8080/positions \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Database Schema

The database is automatically initialized with the schema from `backend/database/init.sql`:

- `users` - User accounts
- `leaders` - Trading leaders  
- `leader_stats` - Leader statistics
- `leader_markets` - Markets traded by leaders
- `follows` - User follow relationships
- `idempotency_keys` - Duplicate request prevention
- `replication_jobs` - Trade replication queue
- `orders` - Order history
- `positions` - User positions
- `aggregated_events` - Market events (from indexer)
- `market_sources` - Market data sources (from indexer)
- `price_history` - Historical price data (from indexer)

## Architecture

### Copy Trading Flow

1. User follows a leader → Creates follow record
2. Leader makes trade → POST to `/events/leader-trade`
3. System creates replication jobs → Available at `/jobs/replications`
4. Worker service picks up jobs → Executes trades
5. Worker completes jobs → POST to `/jobs/replications/{job_id}/complete`
6. Positions and orders updated automatically

### Trade Sizing

The system respects user-defined limits:

- `base_allocation_usdc`: Total capital allocated
- `max_utilization_pct`: Maximum % of allocation to use (e.g., 0.8 = 80%)
- `max_per_trade_pct`: Maximum % per single trade (e.g., 0.2 = 20%)

**Example:**
- Allocation: $1000
- Max utilization: 80% = $800 max total
- Max per trade: 20% = $200 max per trade
- Leader trades $500 → User trades min($200, $800 remaining) = $200

## Maintenance

### Stop Database

```bash
cd backend
docker-compose down
```

### Reset Database

```bash
cd backend
docker-compose down
docker volume rm backend_postgres_data
docker-compose up -d postgres
```

### View Logs

```bash
# Application logs
RUST_LOG=debug cargo run

# Database logs
cd backend
docker-compose logs -f postgres
```

## Production Deployment

1. Change `JWT_SECRET` to a secure random value (min 32 chars)
2. Set `ALLOWED_ORIGINS` to your frontend domain
3. Use production database credentials
4. Build in release mode: `cargo build --release`
5. Run binary: `./target/release/server`
