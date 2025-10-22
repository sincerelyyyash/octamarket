# Opinion Markets Indexer Setup Documentation

## Overview
This document provides step-by-step instructions to set up and test the Opinion Markets Indexer service with PostgreSQL database integration.

## Prerequisites
- Docker and Docker Compose installed
- Rust toolchain installed
- PostgreSQL client tools (optional, for database inspection)

## Setup Steps

### 1. Database Setup

#### Start PostgreSQL Database
```bash
# Start the database container (from backend directory)
cd ../../  # Navigate to backend directory
docker compose up -d postgres

# Wait for database to be ready (about 15 seconds)
sleep 15

# Test database connection
docker-compose exec postgres psql -U postgres -d indexer -c "SELECT 1 as test;"
```

#### Verify Database Schema
```bash
# Check if tables were created (from backend directory)
docker-compose exec postgres psql -U postgres -d indexer -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

Expected output:
```
     table_name      
---------------------
 current_market_data
 price_trends
 price_history
 market_sources
 aggregated_events
```

### 2. Indexer Service Testing

#### Test Without Database (Service Structure)
```bash
cd backend/services/indexer
cargo run
```

Expected behavior:
- Service compiles successfully
- Handles database connection failure gracefully
- Logs appropriate error messages
- Exits cleanly

#### Test With Database (Full Functionality)
```bash
cd backend/services/indexer
export POSTGRES_URL=postgres://postgres:postgres@localhost:5432/indexer
cargo run
```

Expected behavior:
- Service connects to database successfully
- Fetches data from external sources (Polymarket, Augur, etc.)
- Stores events and market data in database
- Processes price information

### 3. Data Verification

#### Check Stored Data
```bash
# Count records in each table (from backend directory)
docker-compose exec postgres psql -U postgres -d indexer -c "
SELECT COUNT(*) as total_events FROM aggregated_events; 
SELECT COUNT(*) as total_market_sources FROM market_sources; 
SELECT COUNT(*) as total_price_history FROM price_history;
"

# View sample data
docker-compose exec postgres psql -U postgres -d indexer -c "
SELECT event_fingerprint, title, status FROM aggregated_events; 
SELECT source, market_id, name FROM market_sources; 
SELECT outcome_name, price FROM price_history;
"
```

## Database Schema

### Tables Created
1. **aggregated_events**: Main events table
   - `id`: UUID primary key
   - `event_fingerprint`: Unique identifier for event deduplication
   - `title`: Event title
   - `description`: Event description
   - `end_time`: Event end time
   - `status`: Event status (active, resolved, etc.)

2. **market_sources**: Market data from various platforms
   - `id`: UUID primary key
   - `aggregated_event_id`: Foreign key to aggregated_events
   - `source`: Platform source (polymarket, augur, etc.)
   - `market_id`: Platform-specific market ID
   - `name`: Market name
   - `outcomes`: JSON array of possible outcomes
   - `prices`: JSON object with current prices
   - `traded_amount`: Total volume traded

3. **price_history**: Historical price data
   - `id`: UUID primary key
   - `market_source_id`: Foreign key to market_sources
   - `outcome_index`: Index of the outcome
   - `outcome_name`: Name of the outcome
   - `price`: Price at timestamp
   - `volume`: Volume at timestamp
   - `timestamp`: When the price was recorded

### Views Created
1. **current_market_data**: Easy querying of current market data
2. **price_trends**: Price trend analysis

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
**Error**: `Failed to initialize indexer pipeline: ...`
**Solution**: Ensure PostgreSQL container is running and accessible

#### 2. SQL Syntax Error
**Error**: `syntax error at or near "NOT"`
**Solution**: The init.sql file has been fixed. Recreate the database:
```bash
docker compose down --volumes
docker compose up -d postgres
```

#### 3. No Data Being Stored
**Check**: Verify the indexer is actually running and processing data
```bash
# Check if indexer process is running
ps aux | grep indexer

# Check database for new data
docker-compose exec postgres psql -U postgres -d indexer -c "SELECT COUNT(*) FROM aggregated_events;"
```

## File Structure

### Key Files
- `docker-compose.yml`: PostgreSQL container configuration (in backend directory)
- `init.sql`: Database schema and sample data (in this directory)
- `src/main.rs`: Main indexer service entry point
- `src/pipeline.rs`: Data processing pipeline
- `src/sources/`: Data source implementations
- `src/clients/postgres.rs`: Database client

### Environment Variables
- `POSTGRES_URL`: Database connection string
  - Format: `postgres://username:password@host:port/database`
  - Example: `postgres://postgres:postgres@localhost:5432/indexer`

## Success Criteria

✅ **Database Setup**
- PostgreSQL container running
- All tables created successfully
- Sample data inserted

✅ **Indexer Service**
- Compiles without errors
- Connects to database successfully
- Fetches data from external sources
- Stores events and market data
- Processes price information

✅ **Data Verification**
- Events stored in `aggregated_events` table
- Market sources stored in `market_sources` table
- Price history stored in `price_history` table

## Quick Commands Reference

```bash
# Start database (from backend directory)
cd ../../  # Navigate to backend directory
docker compose up -d postgres

# Stop database
docker compose down

# Reset database (removes all data)
docker compose down --volumes

# Run indexer without database
cd services/indexer && cargo run

# Run indexer with database
cd services/indexer && export POSTGRES_URL=postgres://postgres:postgres@localhost:5432/indexer && cargo run

# Check database data
docker-compose exec postgres psql -U postgres -d indexer -c "SELECT COUNT(*) FROM aggregated_events;"
```

## Notes

- The indexer service is designed to run continuously and fetch data from multiple prediction market platforms
- Data is deduplicated using event fingerprints
- The service includes rate limiting and retry mechanisms for API calls
- Health monitoring is built into the service for production use
