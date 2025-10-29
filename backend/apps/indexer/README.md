# OctaMarkets Indexer

A comprehensive TypeScript indexer service that continuously ingests prediction market data from multiple sources and normalizes it into a canonical database schema. The indexer supports both market data ingestion and leaderboard/trader tracking with copy trading capabilities.

## Features

- **Multi-Source Data Ingestion**: Supports Polymarket and Kalshi (Augur, Thales, and Omen currently disabled)
- **Real-time Updates**: Uses REST polling and WebSocket connections where available
- **Data Normalization**: Converts all source data into a unified canonical schema
- **Market Deduplication**: Automatically detects and merges duplicate markets across sources
- **Price Tracking**: Continuously monitors and stores price history for active markets
- **Leaderboard Integration**: Tracks trader performance and rankings
- **Copy Trading Support**: Enables automatic copy trading functionality
- **In-Memory Queue System**: Batched database writes with configurable intervals (12 seconds default)
- **Robust Error Handling**: Comprehensive logging and error recovery mechanisms

## Supported Sources

| Source | Type | Status | Features |
|--------|------|--------|----------|
| **Polymarket** | REST + WebSocket | Active | Real-time market updates, price feeds, leaderboard data |
| **Kalshi** | REST + WebSocket | Active | Market data (public), trading requires API key |
| **Augur** | GraphQL Subgraph | Disabled | Deprecated subgraph |
| **Thales** | REST + Contract | Disabled | API not working |
| **Omen** | GraphQL Subgraph | Disabled | Deprecated subgraph |

## Installation

1. Install dependencies:
```bash
bun install
```

2. Set up environment variables:
```bash
# Create .env file with your configuration
# See configuration section below for required variables
```

3. Set up the database (from the root backend directory):
```bash
bun run db:push
```

## Configuration

The indexer uses environment variables for configuration. Key settings include:

- `DATABASE_URL`: PostgreSQL connection string (default: postgresql://postgres:password@localhost:5432/octamarkets)
- `KALSHI_API_KEY`: Optional API key for Kalshi (enables authenticated access)
- `LOG_LEVEL`: Logging verbosity (debug, info, warn, error)
- `QUEUE_BATCH_SIZE`: Number of items to process in each batch (default: 100)
- `QUEUE_FLUSH_INTERVAL`: Queue flush interval in milliseconds (default: 12000)
- `QUEUE_MAX_RETRIES`: Maximum retry attempts for failed items (default: 3)
- `QUEUE_RETRY_DELAY`: Delay between retries in milliseconds (default: 1000)

## Usage

### Development Mode
```bash
bun run dev
```

### Production Mode
```bash
bun run start
```

### Build
```bash
bun run build
```

### Linting and Type Checking
```bash
bun run lint        # ESLint
bun run type-check  # TypeScript checking
```

## Architecture

### Core Components

- **IndexerService**: Main orchestrator that manages all data sources and leaderboard functionality
- **DataSources**: Individual source implementations (Polymarket, Kalshi, etc.)
- **LeaderboardDataSource**: Specialized sources for trader and leaderboard data
- **MarketNormalizer**: Converts source-specific market data to canonical format
- **LeaderboardNormalizer**: Converts trader and trade data to canonical format
- **MarketDeduplicator**: Identifies and merges duplicate markets
- **DatabaseManager**: Handles all database operations with batch support
- **QueueManager**: In-memory queue system for batched database writes

### Data Flow

1. **Ingestion**: Each source polls REST APIs and/or maintains WebSocket connections
2. **Normalization**: Raw data is converted to canonical format (markets, traders, trades)
3. **Deduplication**: New markets are checked against existing ones for duplicates
4. **Queuing**: Normalized data is queued for batch processing (12 second intervals)
5. **Batch Storage**: Queued data is written to database in configurable batches
6. **Price Tracking**: Continuous monitoring of price changes for active markets
7. **Leaderboard Sync**: Regular synchronization of trader rankings and performance
8. **Copy Trading**: Automatic execution of copy trades based on follower settings

### Database Schema

The indexer uses a comprehensive schema with the following key models:

**Market Data:**
- `Market`: Canonical market representation
- `SourceMarket`: Links between canonical markets and source-specific data
- `MarketOutcome`: Individual outcomes/options within markets
- `MarketEvent`: Audit log of all market activities
- `PriceHistory`: Time-series price data
- `MarketMapping`: Deduplication mappings

**Trader and Leaderboard Data:**
- `Trader`: Trader profiles and performance metrics
- `Trade`: Individual trades and copy trading events
- `LeaderboardSnapshot`: Historical leaderboard rankings
- `TraderFollow`: Copy trading relationships and settings

**System State:**
- `IndexerState`: Service state and error tracking

## API Integration Details

### Polymarket
- **REST**: Public API for market data and leaderboard information
- **WebSocket**: Real-time price and volume updates
- **Leaderboard**: Separate data API for trader rankings and performance
- **Rate Limits**: Reasonable limits, no authentication required

### Kalshi
- **REST**: Public market data, trading requires API key
- **WebSocket**: Real-time market updates
- **Rate Limits**: Conservative limits for public data

## Monitoring and Logging

The indexer provides comprehensive logging and monitoring:

- **Structured Logging**: JSON format with contextual information
- **Error Tracking**: Automatic error counting and state management
- **Performance Metrics**: Processing times and success rates
- **Health Checks**: Source connectivity and database status

## Queue System

The indexer uses an in-memory queue system to optimize database performance:

- **Batched Writes**: Events are queued and written to database in configurable batches
- **Configurable Intervals**: Default 12-second flush intervals (configurable via environment)
- **Retry Logic**: Failed items are automatically retried with exponential backoff
- **Memory Efficient**: Separate queues for different data types
- **Graceful Shutdown**: All queues are flushed before service shutdown
- **Monitoring**: Queue statistics are included in service status logs

### Queue Types

- **Market Events**: Market creation, updates, and status changes
- **Price Data**: Real-time price updates and historical data
- **Trade Data**: Individual trades and copy trading events
- **Trader Data**: Trader profiles and performance metrics
- **Leaderboard Data**: Leaderboard snapshots and rankings
- **Trader Follows**: Copy trading relationships and settings

## Error Handling

- **Graceful Degradation**: Individual source failures don't stop the entire service
- **Retry Logic**: Automatic retry with exponential backoff
- **Circuit Breakers**: Temporary source disabling on repeated failures
- **Data Integrity**: Transaction-based operations ensure consistency
- **Queue Resilience**: Failed queue items are retried with configurable limits

## Development

### Project Structure
```
src/
├── config/          # Configuration management
├── core/            # Core business logic
│   ├── indexerService.ts
│   ├── normalizer.ts
│   ├── leaderboardNormalizer.ts
│   ├── deduplicator.ts
│   ├── databaseManager.ts
│   └── queueManager.ts
├── sources/         # Data source implementations
│   ├── polymarket.ts
│   ├── polymarketLeaderboard.ts
│   ├── kalshi.ts
│   ├── augur.ts
│   ├── thales.ts
│   └── omen.ts
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

### Adding New Sources

1. Implement the `DataSource` interface for market data
2. Implement the `LeaderboardDataSource` interface for trader data (if applicable)
3. Add normalization logic to `MarketNormalizer` and/or `LeaderboardNormalizer`
4. Update configuration in `config/index.ts`
5. Register the source in `IndexerService`

### Testing

```bash
bun run lint        # ESLint
bun run type-check  # TypeScript checking
```

## Deployment

The indexer is designed to run as a long-lived service:

1. **Docker**: Containerized deployment with health checks
2. **Process Management**: PM2 or similar for production
3. **Monitoring**: Integration with monitoring systems
4. **Scaling**: Horizontal scaling with source partitioning

## Current Status

- **Active Sources**: Polymarket and Kalshi are fully operational
- **Disabled Sources**: Augur, Thales, and Omen are currently disabled due to API issues
- **Leaderboard**: Polymarket leaderboard integration is active
- **Copy Trading**: Copy trading functionality is implemented and enabled
- **Database**: Uses PostgreSQL with comprehensive schema for markets, traders, and trades

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive error handling
3. Include logging for debugging
4. Update documentation for new features
5. Test with multiple data sources

## License

This project is part of the OctaMarkets platform.
