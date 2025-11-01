# Prediction Market Indexer

A unified indexer for collecting and normalizing prediction market data from Polymarket and Kalshi.

## Features

- **Multi-Source Data Collection**: Collects data from Polymarket and Kalshi APIs
- **Real-Time Updates**: WebSocket connections for live market updates
- **Unified Schema**: Normalizes data from different sources into a canonical format
- **Persistent Storage**: Stores all data in PostgreSQL via Prisma
- **Rate Limiting**: Respects API rate limits with automatic backoff
- **Resilient**: Auto-reconnects WebSockets and retries failed requests
- **State Management**: Tracks sync state and resumes from last position

## Architecture

### Components

- **Collectors**: REST API clients for Polymarket and Kalshi
- **WebSocket Managers**: Real-time data streaming
- **Normalizers**: Unify data formats across sources
- **Processors**: Store normalized data in database
- **Scheduler**: Coordinate polling and manage rate limits

### Data Flow

```
API Sources → Collectors → Normalizers → Processors → Database
              ↑                                         ↓
          WebSockets ← ← ← ← ← ← ← ← ← ← ← ← ← State Tracking
```

## Setup

1. Copy environment variables:
```bash
cp .env.example .env
```

2. Configure the `.env` file with your database URL and API credentials

3. Install dependencies:
```bash
bun install
```

4. Run database migrations (from backend root):
```bash
bun run db:migrate:dev
```

## Usage

### Development
```bash
bun run dev
```

### Production
```bash
bun run start
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `INDEXER_POLL_INTERVAL` - Base polling interval in milliseconds (default: 60000)
- `INDEXER_ENABLED_SOURCES` - Comma-separated list of sources (POLYMARKET,KALSHI)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `KALSHI_API_KEY` - Kalshi API key (required for Kalshi)
- `KALSHI_PRIVATE_KEY` - Kalshi private key PEM (required for Kalshi)

## API Coverage

### Polymarket
- Markets (gamma-api)
- Order books (CLOB)
- Trades and prices
- Leaderboard
- Real-time WebSocket updates

### Kalshi
- Markets
- Order books
- Trades
- Real-time WebSocket updates

## Database Schema

Uses the existing Prisma schema with models:
- `Market` - Canonical market data
- `SourceMarket` - Source-specific market data
- `MarketOutcome` - Market outcomes
- `PriceHistory` - Price tracking
- `Trade` - Trade records
- `Trader` - Trader profiles
- `LeaderboardSnapshot` - Historical leaderboard data
- `IndexerState` - Sync state tracking

