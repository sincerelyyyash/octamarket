# Execution Engine - Quick Start Guide

## Prerequisites

- Bun installed
- Redis server running
- Kalshi API credentials (API key + RSA private key)
- Polymarket wallet (EVM private key)
- Server app running at `http://localhost:3001`

## Setup

### 1. Install Dependencies

```bash
cd backend/apps/execution-engine
bun install

cd ../signer-service
bun install
```

### 2. Configure Signer Service

Create `backend/apps/signer-service/.env`:

```bash
SIGNER_PORT=8081

# Kalshi credentials
KALSHI_API_KEY=your-kalshi-api-key-here
KALSHI_PRIVATE_KEY_PEM="-----BEGIN RSA PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END RSA PRIVATE KEY-----"

# Polymarket credentials
POLYMARKET_PRIVATE_KEY=0xyour-evm-private-key-here
POLYMARKET_CHAIN_ID=137
POLYMARKET_CLOB_ENDPOINT=https://clob.polymarket.com
```

### 3. Configure Execution Engine

Create `backend/apps/execution-engine/.env`:

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
TRADES_INTENTS_STREAM=trades.intents
TRADES_DLQ_STREAM=trades.dlq
TRADES_CONSUMER_GROUP=engine-workers
TRADES_CONSUMER_NAME=engine-1

# Server
SERVER_BASE_URL=http://localhost:3001
SERVER_INTERNAL_TOKEN=optional-token

# Signer
SIGNER_BASE_URL=http://localhost:8081

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### 4. Start Services

Terminal 1 - Signer Service:
```bash
cd backend/apps/signer-service
bun run dev
```

Terminal 2 - Execution Engine:
```bash
cd backend/apps/execution-engine
bun run dev
```

## Testing

### Submit a Test Trade Intent

Use Redis CLI to submit a test intent:

```bash
redis-cli XADD trades.intents * \
  intentId "test-intent-001" \
  userId "user-123" \
  source "POLYMARKET" \
  sourceMarketId "0x36db...3701" \
  marketId "canonical-market-id" \
  side "BUY" \
  quantity "10" \
  outcomeIndex "0" \
  idempotencyKey "test-key-001" \
  createdAt "2025-10-28T10:00:00Z"
```

### Monitor Logs

Watch the execution engine logs:
- Intent received
- Market mapping
- Quote fetching (Kalshi + Polymarket)
- Best venue selection
- Order placement
- Status polling
- Fill detection
- State reporting
  - Server endpoint: `POST /internal/trades/:intentId/state` (requires `SERVER_INTERNAL_TOKEN` if set)

### Check DLQ for Failures

```bash
redis-cli XREAD STREAMS trades.dlq 0
```

## Production Deployment

### Environment-Specific Changes

1. **Signer Service**: Replace with KMS/HSM/Vault integration
2. **Redis**: Use managed Redis (AWS ElastiCache, Redis Cloud)
3. **Monitoring**: Add Prometheus, Datadog, or similar
4. **Secrets**: Use environment-specific secret management
5. **Scaling**: Run multiple consumer instances with unique `TRADES_CONSUMER_NAME`

### Deployment Architecture

```
┌─────────────────┐
│  Mobile/Web App │
│  (React Native/ │
│   Next.js)      │
└────────┬────────┘
         │ POST /api/trades
         ▼
┌─────────────────┐
│  Server API     │
│  (@server)      │
└────────┬────────┘
         │ XADD trades.intents
         ▼
┌─────────────────┐
│  Redis Streams  │
│  (trades.*)     │
└────────┬────────┘
         │ XREADGROUP
         ▼
┌─────────────────┐      ┌──────────────┐
│ Execution Engine│─────→│ Signer       │
│ (this app)      │      │ Service/KMS  │
└────────┬────────┘      └──────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│ Kalshi │ │Polymarket│
│  API   │ │   CLOB   │
└────────┘ └──────────┘
```

### Health Checks

- Signer Service: `GET http://localhost:8081/health`
- Execution Engine: Monitor Redis consumer group lag
- Venues: Monitor order placement success rate

### Scaling Guidelines

- **Horizontal**: Multiple engine instances with same consumer group (load balanced)
- **Vertical**: Increase Redis connection pool if CPU-bound
- **Partitioning**: Use multiple streams for different market types if needed

## Troubleshooting

### Intent not processing
- Check Redis connection: `redis-cli PING`
- Verify consumer group exists: `redis-cli XINFO GROUPS trades.intents`
- Check signer service: `curl http://localhost:8081/health`

### Order not filling
- Check venue API status (Kalshi/Polymarket)
- Verify credentials in signer service
- Review logs for authentication errors
- Check market liquidity

### DLQ items accumulating
- Review DLQ reasons: `dlqReason` field
- Common issues:
  - `INVALID_SCHEMA`: Fix intent format
  - `NO_SOURCE_MARKETS`: Market not mapped in database
  - `MAX_RETRIES`: Venue API down or persistent error

## API Endpoints (Internal)

These should be implemented in `@server`:

### GET `/api/markets/:id`
Returns market with `sourceMarkets` array:
```json
{
  "success": true,
  "data": {
    "id": "canonical-id",
    "sourceMarkets": [
      { "source": "KALSHI", "sourceMarketId": "TICKER-001" },
      { "source": "POLYMARKET", "sourceMarketId": "0x123..." }
    ]
  }
}
```

### POST `/internal/trades/:intentId/state`
Receives execution state updates:
```json
{
  "state": "FILLED",
  "venue": "KALSHI",
  "orderId": "ord_abc123",
  "avgPrice": 0.65,
  "price": 0.65,
  "fills": [
    { "qty": 10, "px": 0.65, "ts": "2025-10-28T10:05:00Z" }
  ]
}
```

## Pricing & Constraints Notes

- Kalshi quotes are outcome-aware:
  - Yes: uses `yes_*`; No: uses `no_*` or `1 - yes` if not available.
- Router constraints:
  - BUY: rejects if price > `constraints.maxPrice`.
  - SELL: rejects if price < `constraints.maxPrice`.

## Next Steps

1. Implement `/internal/trades/:intentId/state` endpoint in `@server`
2. Add market source mappings to database (Kalshi tickers, Polymarket token IDs)
3. Test with real credentials on sandbox/testnet
4. Set up monitoring and alerting
5. Deploy to production with KMS integration

