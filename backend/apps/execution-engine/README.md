# Execution Engine

Production-ready trade execution engine for opinion markets (Kalshi and Polymarket).

## Features

- **Redis Stream Consumer**: Consumes trade intents from `trades.intents` stream with idempotency
- **Multi-Venue Support**: Executes trades on Kalshi and Polymarket based on best price
- **Real Authentication**: RSA signing for Kalshi, EIP-712 for Polymarket
- **Order Lifecycle**: Place, poll status, monitor fills, cancel on timeout
- **Retry Logic**: 3 retries with exponential backoff, DLQ for permanent failures
- **Risk Controls**: Pre-trade checks for notional limits, slippage guards
- **State Reporting**: Reports SUBMITTED/FILLED/FAILED states to server

## Architecture

```
Redis Stream (intents) 
  → Consumer (validate, dedupe)
    → Market Mapper (resolve source markets)
      → Quote Aggregator (fetch best prices from Kalshi + Polymarket)
        → Router (select best venue)
          → Risk Check (notional limits)
            → Executor (place order, poll fill)
              → Reporter (update server state)
```

## Environment Variables

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
TRADES_INTENTS_STREAM=trades.intents
TRADES_DLQ_STREAM=trades.dlq
TRADES_CONSUMER_GROUP=engine-workers

# Server
SERVER_BASE_URL=http://localhost:3001
SERVER_INTERNAL_TOKEN=optional-token

# Signer Service
SIGNER_BASE_URL=http://localhost:8081

# Logging
LOG_LEVEL=info
```

## Running

```bash
bun install
bun run dev
```

## Trade Intent Schema

Submit intents to Redis stream:

```
intentId: unique ID
userId: user ID
marketId: canonical market ID
side: BUY | SELL
quantity: number of contracts
outcomeIndex: (optional) outcome index
constraints: (optional) JSON { maxPrice, maxSlippage }
sourceAllowlist: (optional) JSON ["KALSHI", "POLYMARKET"]
idempotencyKey: unique key for deduplication
```

## Signer Service

Separate service for secure key management. See `/apps/signer-service`.

## Production Considerations

- Replace signer service with KMS/HSM/MPC wallet
- Add monitoring (Prometheus, Datadog)
- Implement circuit breakers
- Add venue balance reconciliation
- Set up alerting for DLQ items

## Engine Behavior Notes

- Outcome-aware pricing for Kalshi:
  - Yes prices use Kalshi `yes_*` fields.
  - No prices use Kalshi `no_*` fields when available; otherwise derived as `1 - yes`.
- Router constraints:
  - For BUY, `constraints.maxPrice` is an upper bound.
  - For SELL, `constraints.maxPrice` is treated as a minimum acceptable price.
- Polymarket fills:
  - `sizeFilled` uses CLOB `size_matched` (executed amount).

