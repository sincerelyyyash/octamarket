# Octamarket - Complete Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Technology Stack](#technology-stack)
5. [Setup Instructions](#setup-instructions)
   - [Quick Start with Docker (Recommended)](#quick-start-with-docker-recommended)
   - [Manual Setup](#manual-setup)
   - [Prerequisites](#prerequisites)
   - [Database Setup](#database-setup)
   - [Backend Indexer Setup](#backend-indexer-setup)
   - [Backend Trading Server Setup](#backend-trading-server-setup)
   - [Frontend Setup](#frontend-setup)
6. [API Documentation](#api-documentation)
   - [Authentication Endpoints](#authentication-endpoints)
   - [Market Aggregation Endpoints](#market-aggregation-endpoints)
   - [Leader & Wallet Tracking Endpoints](#leader--wallet-tracking-endpoints)
   - [Arbitrage Endpoints](#arbitrage-endpoints)
   - [Order Management Endpoints](#order-management-endpoints)
   - [Wallet Management Endpoints](#wallet-management-endpoints)
   - [Copy Trading Endpoints](#copy-trading-endpoints)
   - [Health Check](#health-check)
7. [Usage Examples](#usage-examples)
8. [Database Schema Reference](#database-schema-reference)
9. [Development Guide](#development-guide)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Octamarket** is a comprehensive Prediction Market Aggregator platform that consolidates data from multiple prediction market platforms (Polymarket, Augur, Kalshi, Thales, Omen) to provide users with:

- Best price discovery across markets
- Arbitrage opportunity detection
- Wallet tracking and trader analytics
- Direct order execution on supported platforms
- Copy trading capabilities to follow successful traders

The platform consists of three main components:
1. **Indexer Service**: Data collection, normalization, and wallet tracking
2. **Trading Server**: REST API for market aggregation, order execution, and copy trading
3. **Frontend Web App**: User interface built with Next.js and React

---

## Features

### Market Data Aggregation
- **Multi-Platform Support**: Aggregates data from 5 major prediction market platforms
- **Event Fingerprinting**: SHA256-based deduplication to group identical markets across platforms
- **Real-time Price Tracking**: Continuous monitoring of market prices and volumes
- **Historical Data**: Price history tracking for trend analysis

### Price Discovery & Best Execution
- **Best Price Finder**: Automatically identifies the best buy/sell prices across all platforms
- **Price Caching**: In-memory cache for fast price lookups
- **Background Refresh**: Periodic cache updates to maintain fresh data

### Arbitrage Detection
- **Cross-Platform Arbitrage**: Identifies price discrepancies between different platforms
- **Profit Calculation**: Automatic calculation of potential profits accounting for fees
- **Risk Analysis**: Evaluates capital requirements and execution risks
- **Alert System**: Stores and notifies users of detected opportunities

### Wallet Tracking & Analytics
- **Real-time Wallet Monitoring**: Tracks specific blockchain wallet addresses on prediction markets
- **Trade History**: Complete record of all trades made by tracked wallets
- **Performance Statistics**: Win rate, PnL, volume, and other key metrics
- **Leaderboard**: Rankings of top-performing traders

### Order Execution
- **Platform Abstraction**: Unified interface for placing orders across different platforms
- **Order Types**: Support for market and limit orders
- **Status Tracking**: Real-time order status updates
- **Transaction History**: Complete audit trail of all orders

### Copy Trading
- **Leader Tracking**: Follow successful traders and replicate their strategies
- **Risk Management**: Configurable position sizing and allocation limits
- **Auto-replication**: Automatic order placement based on leader trades
- **Performance Tracking**: Monitor your copy trading performance

### User Management
- **Authentication**: JWT-based secure authentication
- **Wallet Connection**: Link blockchain wallets to user accounts
- **Order History**: View all past and current orders
- **Position Management**: Track open positions across platforms

---

## Architecture

Octamarket uses a **dual-database architecture** to separate concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                     (Next.js + React)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Trading Server                            │
│                   (Rust + Axum + SQLx)                       │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐     │
│  │   Price     │  │  Arbitrage   │  │    Order      │     │
│  │ Aggregator  │  │   Detector   │  │   Executor    │     │
│  └─────────────┘  └──────────────┘  └───────────────┘     │
│                                                              │
│  ┌─────────────────┐              ┌────────────────┐       │
│  │  Octamarket DB  │◄─────────────┤  Indexer DB    │       │
│  │  (Read/Write)   │   Read-Only  │  (Read-Only)   │       │
│  └─────────────────┘              └────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                                            ▲
                                            │
┌─────────────────────────────────────────────────────────────┐
│                      Indexer Service                         │
│                   (Rust + Tokio + SQLx)                      │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐     │
│  │   Market     │  │    Wallet     │  │    Event    │     │
│  │   Indexer    │  │   Tracker     │  │ Fingerprint │     │
│  └──────────────┘  └───────────────┘  └─────────────┘     │
│                                                              │
│         │                    │                              │
│         ▼                    ▼                              │
│  ┌─────────────────────────────────────────────┐           │
│  │            Indexer Database                  │           │
│  │         (PostgreSQL - Read/Write)            │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
  External APIs:      Blockchain:
  - Polymarket        - On-chain trades
  - Augur             - Wallet activities
  - Kalshi
  - Thales
  - Omen
```

### Key Components:

1. **Indexer Database**: Stores market data, price history, tracked wallets, and wallet trades
2. **Octamarket Database**: Stores user accounts, orders, positions, arbitrage alerts, and copy trading data
3. **Trading Server**: Reads from both databases, writes to Octamarket DB only
4. **Indexer Service**: Writes to Indexer DB, tracks markets and wallets

---

## Technology Stack

### Backend
- **Language**: Rust (Edition 2021)
- **Runtime**: Tokio (async runtime)
- **Web Framework**: Axum (0.7)
- **Database**: PostgreSQL 14+
- **Database Driver**: SQLx (async SQL driver with compile-time verification)
- **Authentication**: JWT with bcrypt password hashing
- **HTTP Client**: Reqwest (for external API calls)

### Frontend
- **Framework**: Next.js 15.5.6 with React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Data Fetching**: TanStack React Query 5.62
- **HTTP Client**: Axios 1.7
- **Charts**: Chart.js 4.5 with react-chartjs-2

### DevOps
- **Containerization**: Docker (optional)
- **Database Migrations**: SQL scripts
- **Environment Management**: .env files

---

## Setup Instructions

### Quick Start with Docker (Recommended)

The fastest way to get Octamarket running is with Docker. This method handles all dependencies, databases, and services automatically.

**Requirements:**
- Docker 20.10+
- Docker Compose 2.0+

**For detailed Docker setup instructions, see [DOCKER_SETUP.md](DOCKER_SETUP.md)**

**Quick Start (3 commands):**

```bash
# 1. Create environment file with JWT secret
./quick-start.sh    # Linux/Mac
# or
.\quick-start.ps1   # Windows PowerShell

# Services will be available at:
# - Frontend: http://localhost:3000
# - API: http://localhost:8080
# - Databases: localhost:5432 (indexer), localhost:5433 (octamarket)
```

**Manual Docker Setup:**

```bash
# 1. Copy environment file
cp env.docker.example .env

# 2. Generate JWT secret
openssl rand -base64 32

# 3. Edit .env and add the generated secret
nano .env

# 4. Start all services
docker compose up -d

# 5. Check status
docker compose ps

# 6. View logs
docker compose logs -f
```

**That's it!** Skip to [Accessing Services](#accessing-services) or [API Documentation](#api-documentation).

---

### Manual Setup

If you prefer to run services without Docker or need development setup, follow the manual installation steps below.

### Prerequisites

Before setting up Octamarket, ensure you have the following installed:

- **PostgreSQL** 14 or higher
- **Rust** 1.70+ (with cargo)
- **Node.js** 20+ and npm/pnpm
- **Git**

### Database Setup

#### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/)

#### 2. Create Databases

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create databases
CREATE DATABASE indexer;
CREATE DATABASE octamarket;

# Create user (optional, for production)
CREATE USER octamarket_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE indexer TO octamarket_user;
GRANT ALL PRIVILEGES ON DATABASE octamarket TO octamarket_user;

# Exit
\q
```

#### 3. Run Schema Migrations

**Indexer Database:**
```bash
cd backend/services/indexer
psql -U postgres -d indexer -f init.sql
```

**Octamarket Database:**
```bash
cd backend/services/server
psql -U postgres -d octamarket -f schema-octamarket.sql
```

#### 4. Verify Database Setup

```bash
# Check indexer database
psql -U postgres -d indexer -c "\dt"

# Check octamarket database
psql -U postgres -d octamarket -c "\dt"
```

You should see all tables created successfully.

---

### Backend Indexer Setup

The indexer service collects market data and tracks wallet activities.

#### 1. Navigate to Indexer Directory

```bash
cd backend/services/indexer
```

#### 2. Configure Environment Variables

Create a `.env` file or set environment variables:

```bash
# Required
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/indexer

# Optional API Keys (for specific platforms)
KALSHI_API_KEY=your_kalshi_api_key
KALSHI_API_SECRET=your_kalshi_api_secret

# Indexer Configuration
PRICE_FETCH_INTERVAL_SECONDS=60
MAX_REQUESTS_PER_MINUTE=100
REQUEST_TIMEOUT_SECONDS=30
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_SECONDS=5

# Wallet Tracking Configuration
ENABLE_WALLET_TRACKING=true
WALLET_TRACKING_INTERVAL_SECONDS=60
WALLET_STATS_UPDATE_INTERVAL_SECONDS=300
```

#### 3. Build the Indexer

```bash
cargo build --release
```

#### 4. Run the Indexer

```bash
# Development mode (with logs)
RUST_LOG=indexer=debug,info cargo run

# Production mode
./target/release/indexer
```

#### 5. Verify Indexer is Running

Check the logs for:
```
[INFO] Indexer pipeline starting...
[INFO] Connected to database
[INFO] Starting price fetcher...
[INFO] Wallet tracker initialized
```

The indexer will now:
- Fetch market data from all platforms every 60 seconds (configurable)
- Track wallet addresses for trades
- Update wallet statistics periodically
- Store price history

---

### Backend Trading Server Setup

The trading server provides the REST API for the frontend.

#### 1. Navigate to Server Directory

```bash
cd backend/services/server
```

#### 2. Configure Environment Variables

Create a `.env` file:

```bash
# Database Configuration
DATABASE_URL=postgres://postgres:postgres@localhost:5432/octamarket
INDEXER_DB_URL=postgres://postgres:postgres@localhost:5432/indexer

# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# JWT Authentication (REQUIRED - Generate a secure secret)
JWT_SECRET=your_very_secure_random_secret_at_least_32_chars

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# External APIs
POLYMARKET_CLOB_URL=https://clob.polymarket.com

# Background Tasks Configuration
CACHE_REFRESH_INTERVAL_SECONDS=5
ARBITRAGE_MIN_PROFIT_PCT=0.5
ARBITRAGE_SCAN_INTERVAL_SECONDS=10

# Logging
RUST_LOG=server=debug,tower_http=debug
```

**Important**: Generate a secure JWT secret:
```bash
openssl rand -base64 32
```

#### 3. Build the Server

```bash
cargo build --release
```

#### 4. Run the Server

```bash
# Development mode
cargo run

# Production mode
./target/release/server
```

#### 5. Verify Server is Running

Check the logs for:
```
[INFO] Starting Octamarket trading server
[INFO] Trading DB: postgres://...
[INFO] Indexer DB: postgres://...
[INFO] Database connections established
[INFO] Starting best prices cache refresh (interval: 5s)
[INFO] Starting arbitrage scanning (interval: 10s, min profit: 0.5%)
[INFO] All background tasks started
[INFO] Octamarket server listening on http://0.0.0.0:8080
```

#### 6. Test the API

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

### Frontend Setup

The frontend is a Next.js application with React Query for data fetching.

#### 1. Navigate to Frontend Directory

```bash
cd frontend/web
```

#### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

#### 3. Configure Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

For production:
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

#### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

#### 5. Build for Production

```bash
npm run build
npm start
```

---

## API Documentation

Base URL: `http://localhost:8080` (development)

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

### Authentication Endpoints

#### 1. Register User

Create a new user account.

**Endpoint:** `POST /auth/register`

**Authentication:** Not required

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "user_123abc"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password123"
  }'
```

**Possible Errors:**
- `400`: Email already exists
- `422`: Invalid email format or password too weak
- `500`: Internal server error

---

#### 2. Login

Authenticate and receive a JWT token.

**Endpoint:** `POST /auth/login`

**Authentication:** Not required

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "user_123abc"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password123"
  }'
```

**Possible Errors:**
- `401`: Invalid credentials
- `422`: Missing email or password
- `500`: Internal server error

---

### Market Aggregation Endpoints

#### 3. Get All Markets

Retrieve a list of aggregated markets from all platforms.

**Endpoint:** `GET /markets`

**Authentication:** Not required

**Query Parameters:**
- `limit` (optional): Number of markets to return (default: 50)
- `page` (optional): Page number for pagination (default: 1)

**Request Headers:**
```
Content-Type: application/json
```

**Response (200 OK):**
```json
[
  {
    "event_fingerprint": "abc123...",
    "title": "Will Bitcoin reach $100,000 by end of 2024?",
    "description": "Prediction market for Bitcoin price",
    "end_time": "2024-12-31T23:59:59Z",
    "status": "active",
    "source_count": 3,
    "created_at": "2024-01-15T10:00:00Z"
  },
  {
    "event_fingerprint": "def456...",
    "title": "Will the next US President be from a third party?",
    "description": "Political prediction market",
    "end_time": "2024-11-05T23:59:59Z",
    "status": "active",
    "source_count": 2,
    "created_at": "2024-01-10T08:30:00Z"
  }
]
```

**curl Example:**
```bash
curl http://localhost:8080/markets?limit=10&page=1
```

---

#### 4. Get Market Sources

Get all platform-specific sources for a particular event.

**Endpoint:** `GET /markets/:event_fingerprint/sources`

**Authentication:** Not required

**Path Parameters:**
- `event_fingerprint`: The unique fingerprint of the event

**Response (200 OK):**
```json
[
  {
    "id": "source_123",
    "source": "polymarket",
    "market_id": "0x1234...",
    "market_slug": "bitcoin-100k-2024",
    "name": "Bitcoin $100K by 2024",
    "status": "active",
    "outcomes": ["Yes", "No"],
    "prices": [0.65, 0.35],
    "traded_amount": 1500000.50,
    "observed_at": "2024-01-20T15:30:00Z"
  },
  {
    "id": "source_456",
    "source": "augur",
    "market_id": "aug_market_789",
    "name": "BTC to 100K",
    "status": "active",
    "outcomes": ["Yes", "No"],
    "prices": [0.68, 0.32],
    "traded_amount": 500000.25,
    "observed_at": "2024-01-20T15:25:00Z"
  }
]
```

**curl Example:**
```bash
curl http://localhost:8080/markets/abc123.../sources
```

**Possible Errors:**
- `404`: Event fingerprint not found

---

#### 5. Get Best Price for Event

Get the best buy/sell prices across all platforms for a specific event.

**Endpoint:** `GET /markets/:event_fingerprint/best-price`

**Authentication:** Not required

**Path Parameters:**
- `event_fingerprint`: The unique fingerprint of the event

**Response (200 OK):**
```json
{
  "event_fingerprint": "abc123...",
  "event_title": "Will Bitcoin reach $100,000 by end of 2024?",
  "best_yes_price": 0.68,
  "best_yes_platform": "augur",
  "best_yes_market_id": "aug_market_789",
  "best_no_price": 0.35,
  "best_no_platform": "polymarket",
  "best_no_market_id": "0x1234...",
  "last_updated": "2024-01-20T15:30:00Z"
}
```

**curl Example:**
```bash
curl http://localhost:8080/markets/abc123.../best-price
```

**Possible Errors:**
- `404`: Event fingerprint not found
- `500`: Error calculating best prices

---

### Leader & Wallet Tracking Endpoints

#### 6. Get Leaders

Retrieve a list of traders available for copy trading.

**Endpoint:** `GET /leaders`

**Authentication:** Not required

**Response (200 OK):**
```json
[
  {
    "leader_id": "leader_001",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "platform": "polymarket",
    "name": "CryptoWhale",
    "bio": "Professional prediction market trader",
    "avatar_url": "https://example.com/avatar.jpg",
    "is_verified": true,
    "followers_count": 150,
    "pnl_7d": 15000.50,
    "pnl_30d": 45000.75,
    "win_rate": 0.68,
    "total_trades": 234
  }
]
```

**curl Example:**
```bash
curl http://localhost:8080/leaders
```

---

#### 7. Get Leader Details

Get detailed information about a specific leader.

**Endpoint:** `GET /leaders/:leader_id`

**Authentication:** Not required

**Path Parameters:**
- `leader_id`: The unique ID of the leader

**Response (200 OK):**
```json
{
  "leader_id": "leader_001",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "platform": "polymarket",
  "name": "CryptoWhale",
  "bio": "Professional prediction market trader",
  "avatar_url": "https://example.com/avatar.jpg",
  "is_verified": true,
  "followers_count": 150,
  "stats": {
    "pnl_7d": 15000.50,
    "pnl_30d": 45000.75,
    "pnl_all_time": 125000.00,
    "win_rate": 0.68,
    "total_trades": 234
  },
  "markets": [
    "bitcoin-100k-2024",
    "eth-price-prediction",
    "us-election-2024"
  ]
}
```

**curl Example:**
```bash
curl http://localhost:8080/leaders/leader_001
```

**Possible Errors:**
- `404`: Leader not found

---

#### 8. Get Wallet Leaderboard

Retrieve top-performing tracked wallets.

**Endpoint:** `GET /wallet-leaderboard`

**Authentication:** Not required

**Query Parameters:**
- `limit` (optional): Number of wallets to return (default: 50)

**Response (200 OK):**
```json
[
  {
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "platform": "polymarket",
    "nickname": "CryptoWhale",
    "total_trades": 234,
    "win_count": 159,
    "loss_count": 75,
    "total_volume": 2500000.00,
    "pnl_7d": 15000.50,
    "pnl_30d": 45000.75,
    "pnl_all_time": 125000.00,
    "win_rate": 0.68,
    "avg_position_size": 10683.76,
    "last_trade_at": "2024-01-20T14:30:00Z"
  }
]
```

**curl Example:**
```bash
curl http://localhost:8080/wallet-leaderboard?limit=20
```

---

#### 9. Get Wallet Trades

Retrieve trade history for a specific wallet.

**Endpoint:** `GET /wallets/:wallet_address/trades`

**Authentication:** Not required

**Path Parameters:**
- `wallet_address`: The blockchain wallet address

**Query Parameters:**
- `limit` (optional): Number of trades to return (default: 50)

**Response (200 OK):**
```json
[
  {
    "platform": "polymarket",
    "market_id": "0x1234...",
    "side": "buy",
    "outcome_name": "Yes",
    "price": 0.65,
    "amount": 1000.00,
    "tx_hash": "0xabc123...",
    "timestamp": "2024-01-20T14:30:00Z"
  },
  {
    "platform": "polymarket",
    "market_id": "0x5678...",
    "side": "sell",
    "outcome_name": "No",
    "price": 0.42,
    "amount": 500.00,
    "tx_hash": "0xdef456...",
    "timestamp": "2024-01-19T10:15:00Z"
  }
]
```

**curl Example:**
```bash
curl http://localhost:8080/wallets/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb/trades?limit=10
```

**Possible Errors:**
- `404`: Wallet not found or not tracked

---

### Arbitrage Endpoints

#### 10. Get Arbitrage Opportunities

Retrieve active arbitrage opportunities.

**Endpoint:** `GET /arbitrage/opportunities`

**Authentication:** Not required

**Query Parameters:**
- `limit` (optional): Number of opportunities to return (default: 50)

**Response (200 OK):**
```json
[
  {
    "id": "arb_001",
    "event_fingerprint": "abc123...",
    "event_title": "Will Bitcoin reach $100,000 by end of 2024?",
    "opportunity_type": "cross_platform",
    "profit_pct": 2.5,
    "profit_amount_usd": 250.00,
    "buy_platform": "polymarket",
    "buy_market_id": "0x1234...",
    "buy_outcome": "Yes",
    "buy_price": 0.65,
    "sell_platform": "augur",
    "sell_market_id": "aug_market_789",
    "sell_outcome": "Yes",
    "sell_price": 0.68,
    "min_capital_required": 10000.00,
    "detected_at": "2024-01-20T15:30:00Z",
    "expires_at": "2024-01-20T15:35:00Z",
    "status": "active"
  }
]
```

**curl Example:**
```bash
curl http://localhost:8080/arbitrage/opportunities?limit=10
```

---

#### 11. Get Arbitrage Opportunity Details

Get detailed information about a specific arbitrage opportunity.

**Endpoint:** `GET /arbitrage/opportunities/:id`

**Authentication:** Not required

**Path Parameters:**
- `id`: The unique ID of the arbitrage opportunity

**Response (200 OK):**
```json
{
  "id": "arb_001",
  "event_fingerprint": "abc123...",
  "event_title": "Will Bitcoin reach $100,000 by end of 2024?",
  "opportunity_type": "cross_platform",
  "profit_pct": 2.5,
  "profit_amount_usd": 250.00,
  "buy_platform": "polymarket",
  "buy_market_id": "0x1234...",
  "buy_outcome": "Yes",
  "buy_price": 0.65,
  "sell_platform": "augur",
  "sell_market_id": "aug_market_789",
  "sell_outcome": "Yes",
  "sell_price": 0.68,
  "min_capital_required": 10000.00,
  "detected_at": "2024-01-20T15:30:00Z",
  "expires_at": "2024-01-20T15:35:00Z",
  "status": "active"
}
```

**curl Example:**
```bash
curl http://localhost:8080/arbitrage/opportunities/arb_001
```

**Possible Errors:**
- `404`: Opportunity not found

---

### Order Management Endpoints

#### 12. Place Order

Place a new order on a prediction market.

**Endpoint:** `POST /orders/place`

**Authentication:** Required

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```

**Request Body:**
```json
{
  "market_id": "0x1234...",
  "platform": "polymarket",
  "side": "buy",
  "outcome": "Yes",
  "price": 0.65,
  "amount": 100.00,
  "order_type": "limit"
}
```

**Field Descriptions:**
- `market_id`: The platform-specific market identifier
- `platform`: (optional) The platform to place the order on (defaults to best price)
- `side`: "buy" or "sell"
- `outcome`: The outcome to bet on (e.g., "Yes", "No")
- `price`: The price per share (0-1 for binary markets)
- `amount`: The amount in USD to spend
- `order_type`: "market" or "limit"

**Response (200 OK):**
```json
{
  "order_id": "order_123abc",
  "status": "pending",
  "message": "Order submitted successfully"
}
```

**curl Example:**
```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:8080/orders/place \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "market_id": "0x1234...",
    "platform": "polymarket",
    "side": "buy",
    "outcome": "Yes",
    "price": 0.65,
    "amount": 100.00,
    "order_type": "limit"
  }'
```

**Possible Errors:**
- `400`: Invalid order parameters
- `401`: Not authenticated
- `404`: Market not found or no wallet connected for platform
- `500`: Order placement failed

---

#### 13. Get My Orders

Retrieve your order history.

**Endpoint:** `GET /orders/my`

**Authentication:** Required

**Request Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Query Parameters:**
- `limit` (optional): Number of orders to return (default: 50)

**Response (200 OK):**
```json
[
  {
    "id": "order_123abc",
    "user_id": "user_123",
    "platform": "polymarket",
    "market_id": "0x1234...",
    "event_fingerprint": "abc123...",
    "side": "buy",
    "outcome": "Yes",
    "outcome_index": 0,
    "price": 0.65,
    "amount": 100.00,
    "order_type": "limit",
    "status": "filled",
    "filled_amount": 100.00,
    "avg_fill_price": 0.65,
    "tx_hash": "0xabc123...",
    "venue_order_id": "venue_order_456",
    "error_message": null,
    "created_at": "2024-01-20T14:30:00Z",
    "updated_at": "2024-01-20T14:31:00Z"
  }
]
```

**curl Example:**
```bash
TOKEN="your_jwt_token_here"

curl http://localhost:8080/orders/my?limit=20 \
  -H "Authorization: Bearer $TOKEN"
```

**Possible Errors:**
- `401`: Not authenticated

---

#### 14. Cancel Order

Cancel an existing order.

**Endpoint:** `DELETE /orders/:order_id/cancel`

**Authentication:** Required

**Request Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Path Parameters:**
- `order_id`: The unique ID of the order to cancel

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order cancelled"
}
```

**curl Example:**
```bash
TOKEN="your_jwt_token_here"

curl -X DELETE http://localhost:8080/orders/order_123abc/cancel \
  -H "Authorization: Bearer $TOKEN"
```

**Possible Errors:**
- `401`: Not authenticated
- `404`: Order not found or not owned by user
- `400`: Order cannot be cancelled (already filled or cancelled)

---

### Wallet Management Endpoints

#### 15. Connect Wallet

Connect a blockchain wallet to your account.

**Endpoint:** `POST /wallets/connect`

**Authentication:** Required

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```

**Request Body:**
```json
{
  "platform": "polymarket",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "signature": "0x..."
}
```

**Response (200 OK):**
```json
{
  "id": "wallet_uuid",
  "user_id": "user_123",
  "platform": "polymarket",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "is_primary": false,
  "is_verified": true,
  "created_at": "2024-01-20T14:30:00Z"
}
```

**curl Example:**
```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:8080/wallets/connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "platform": "polymarket",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "signature": "0x..."
  }'
```

**Possible Errors:**
- `401`: Not authenticated
- `400`: Invalid wallet address or signature verification failed
- `409`: Wallet already connected to another account

---

#### 16. Get My Wallets

Retrieve all wallets connected to your account.

**Endpoint:** `GET /wallets/my`

**Authentication:** Required

**Request Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "id": "wallet_uuid_1",
    "user_id": "user_123",
    "platform": "polymarket",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "is_primary": true,
    "is_verified": true,
    "created_at": "2024-01-15T10:00:00Z"
  },
  {
    "id": "wallet_uuid_2",
    "user_id": "user_123",
    "platform": "augur",
    "wallet_address": "0x8Ba1f109551bD432803012645Ac136ddd64DBA72",
    "is_primary": false,
    "is_verified": true,
    "created_at": "2024-01-18T12:30:00Z"
  }
]
```

**curl Example:**
```bash
TOKEN="your_jwt_token_here"

curl http://localhost:8080/wallets/my \
  -H "Authorization: Bearer $TOKEN"
```

**Possible Errors:**
- `401`: Not authenticated

---

### Copy Trading Endpoints

**Note:** Copy trading endpoints are currently stubs and return placeholder responses. Full implementation is planned for future releases.

#### 17. Follow a Leader

Start following a leader for copy trading.

**Endpoint:** `POST /follow`

**Authentication:** Required

**Status:** Stub implementation

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Follow functionality coming soon"
}
```

---

#### 18. Get My Follows

Retrieve leaders you're currently following.

**Endpoint:** `GET /follows/me`

**Authentication:** Required

**Status:** Stub implementation

**Response (200 OK):**
```json
[]
```

---

#### 19. Update Follow Settings

Update settings for a follow relationship.

**Endpoint:** `PATCH /follow/:follow_id`

**Authentication:** Required

**Status:** Stub implementation

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Update follow functionality coming soon"
}
```

---

#### 20. Pause Follow

Temporarily pause copy trading for a leader.

**Endpoint:** `POST /follow/:follow_id/pause`

**Authentication:** Required

**Status:** Stub implementation

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pause functionality coming soon"
}
```

---

#### 21. Resume Follow

Resume copy trading for a leader.

**Endpoint:** `POST /follow/:follow_id/resume`

**Authentication:** Required

**Status:** Stub implementation

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Resume functionality coming soon"
}
```

---

#### 22. Unfollow a Leader

Stop following a leader.

**Endpoint:** `POST /unfollow`

**Authentication:** Required

**Status:** Stub implementation

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Unfollow functionality coming soon"
}
```

---

### Health Check

#### 23. Health Check

Check if the server is running and responsive.

**Endpoint:** `GET /health`

**Authentication:** Not required

**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

**curl Example:**
```bash
curl http://localhost:8080/health
```

---

## Usage Examples

### Example 1: User Registration & Authentication

**Step 1: Register a new user**
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "MySecurePass123!"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "user_abc123"
}
```

**Step 2: Save the token**
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Step 3: Use the token for authenticated requests**
```bash
curl http://localhost:8080/wallets/my \
  -H "Authorization: Bearer $TOKEN"
```

---

### Example 2: Viewing Markets & Best Prices

**Step 1: Get all available markets**
```bash
curl http://localhost:8080/markets?limit=5
```

**Step 2: Pick a market and get its sources**
```bash
EVENT_FP="abc123..."
curl http://localhost:8080/markets/$EVENT_FP/sources
```

**Step 3: Get the best price across all platforms**
```bash
curl http://localhost:8080/markets/$EVENT_FP/best-price
```

**Response:**
```json
{
  "event_fingerprint": "abc123...",
  "event_title": "Will Bitcoin reach $100,000 by end of 2024?",
  "best_yes_price": 0.68,
  "best_yes_platform": "augur",
  "best_yes_market_id": "aug_market_789",
  "best_no_price": 0.35,
  "best_no_platform": "polymarket",
  "best_no_market_id": "0x1234...",
  "last_updated": "2024-01-20T15:30:00Z"
}
```

---

### Example 3: Placing an Order

**Prerequisites:**
- You must be authenticated (have a JWT token)
- You must have a wallet connected for the platform

**Step 1: Connect a wallet (if not already connected)**
```bash
curl -X POST http://localhost:8080/wallets/connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "platform": "polymarket",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "signature": "0xsignature..."
  }'
```

**Step 2: Place an order**
```bash
curl -X POST http://localhost:8080/orders/place \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "market_id": "0x1234...",
    "platform": "polymarket",
    "side": "buy",
    "outcome": "Yes",
    "price": 0.65,
    "amount": 100.00,
    "order_type": "limit"
  }'
```

**Step 3: Check order status**
```bash
curl http://localhost:8080/orders/my?limit=1 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Example 4: Finding Arbitrage Opportunities

**Step 1: Get current arbitrage opportunities**
```bash
curl http://localhost:8080/arbitrage/opportunities?limit=10
```

**Step 2: Get details on a specific opportunity**
```bash
curl http://localhost:8080/arbitrage/opportunities/arb_001
```

**Step 3: Execute arbitrage (place orders on both sides)**
```bash
# Buy on the cheaper platform
curl -X POST http://localhost:8080/orders/place \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "market_id": "0x1234...",
    "platform": "polymarket",
    "side": "buy",
    "outcome": "Yes",
    "price": 0.65,
    "amount": 1000.00,
    "order_type": "limit"
  }'

# Sell on the more expensive platform
curl -X POST http://localhost:8080/orders/place \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "market_id": "aug_market_789",
    "platform": "augur",
    "side": "sell",
    "outcome": "Yes",
    "price": 0.68,
    "amount": 1000.00,
    "order_type": "limit"
  }'
```

---

### Example 5: Following a Leader (Copy Trading)

**Step 1: View the leaderboard**
```bash
curl http://localhost:8080/wallet-leaderboard?limit=10
```

**Step 2: Get details on a specific leader**
```bash
curl http://localhost:8080/leaders/leader_001
```

**Step 3: Follow the leader**
```bash
curl -X POST http://localhost:8080/follow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "leader_id": "leader_001",
    "base_allocation_usdc": 1000.00,
    "max_per_trade_pct": 0.1,
    "slippage_bps": 50
  }'
```

**Note:** Copy trading is currently a stub implementation and will be fully functional in future releases.

---

### Example 6: Viewing Order History

**Get your recent orders:**
```bash
curl http://localhost:8080/orders/my?limit=20 \
  -H "Authorization: Bearer $TOKEN"
```

**Filter orders by status (requires custom implementation):**
```bash
curl "http://localhost:8080/orders/my?limit=20&status=filled" \
  -H "Authorization: Bearer $TOKEN"
```

**Cancel a pending order:**
```bash
curl -X DELETE http://localhost:8080/orders/order_123abc/cancel \
  -H "Authorization: Bearer $TOKEN"
```

---

## Database Schema Reference

### Indexer Database (`indexer`)

#### Core Tables

**aggregated_events**
- `id` (UUID): Primary key
- `event_fingerprint` (TEXT): SHA256 hash of normalized title + end_time
- `title` (TEXT): Event title
- `description` (TEXT): Event description
- `end_time` (TIMESTAMP): Event end time
- `status` (TEXT): 'active', 'resolved', 'cancelled'
- `created_at`, `updated_at` (TIMESTAMP)

**market_sources**
- `id` (UUID): Primary key
- `aggregated_event_id` (UUID): Foreign key to aggregated_events
- `source` (TEXT): Platform name (polymarket, augur, etc.)
- `market_id` (TEXT): Platform-specific market ID
- `market_slug` (TEXT): URL-friendly slug
- `name` (TEXT): Market name on the platform
- `status` (TEXT): Market status
- `outcomes` (JSONB): Array of possible outcomes
- `prices` (JSONB): Current prices for each outcome
- `traded_amount` (NUMERIC): Total trading volume
- `resolved_outcome` (TEXT): Winning outcome (if resolved)
- `observed_at` (TIMESTAMP): Last observation time
- `raw_payload` (JSONB): Complete raw data from platform
- `created_at` (TIMESTAMP)

**price_history**
- `id` (UUID): Primary key
- `market_source_id` (UUID): Foreign key to market_sources
- `outcome_index` (INTEGER): Index of the outcome
- `outcome_name` (TEXT): Name of the outcome
- `price` (NUMERIC): Price at this point in time
- `volume` (NUMERIC): Volume at this price
- `timestamp` (TIMESTAMP): Time of this price point
- `source_data` (JSONB): Additional metadata

#### Wallet Tracking Tables

**tracked_wallets**
- `id` (UUID): Primary key
- `wallet_address` (TEXT): Blockchain wallet address (unique)
- `platform` (TEXT): Platform being tracked
- `nickname` (TEXT): Optional display name
- `is_active` (BOOLEAN): Whether to actively track this wallet
- `created_at`, `updated_at` (TIMESTAMP)

**wallet_trades**
- `id` (UUID): Primary key
- `wallet_id` (UUID): Foreign key to tracked_wallets
- `platform` (TEXT): Platform where trade occurred
- `market_id` (TEXT): Market identifier
- `side` (TEXT): 'buy' or 'sell'
- `outcome_index` (INTEGER): Outcome index
- `outcome_name` (TEXT): Outcome name
- `price` (NUMERIC): Trade price
- `amount` (NUMERIC): Trade amount
- `tx_hash` (TEXT): Transaction hash (unique per trade)
- `timestamp` (TIMESTAMP): Trade timestamp
- `raw_data` (JSONB): Complete trade data
- `created_at` (TIMESTAMP)

**wallet_stats**
- `wallet_id` (UUID): Primary key, foreign key to tracked_wallets
- `total_trades` (INTEGER): Total number of trades
- `win_count` (INTEGER): Number of winning trades
- `loss_count` (INTEGER): Number of losing trades
- `total_volume` (NUMERIC): Total USD volume traded
- `pnl_7d` (NUMERIC): Profit/loss last 7 days
- `pnl_30d` (NUMERIC): Profit/loss last 30 days
- `pnl_all_time` (NUMERIC): All-time profit/loss
- `win_rate` (NUMERIC): Percentage of winning trades
- `avg_position_size` (NUMERIC): Average trade size
- `largest_win` (NUMERIC): Biggest winning trade
- `largest_loss` (NUMERIC): Biggest losing trade
- `sharpe_ratio` (NUMERIC): Risk-adjusted return metric
- `last_trade_at` (TIMESTAMP): Most recent trade timestamp
- `last_updated` (TIMESTAMP): Last stats calculation time

#### Views

**current_market_data**: Aggregated events with their current market sources
**price_trends**: Price history with event context
**wallet_leaderboard**: Top-performing tracked wallets with stats

---

### Octamarket Database (`octamarket`)

#### User Management

**users**
- `user_id` (VARCHAR): Primary key
- `email` (VARCHAR): Unique email address
- `password_hash` (VARCHAR): Bcrypt password hash
- `created_at`, `updated_at` (TIMESTAMP)

**user_wallets**
- `id` (UUID): Primary key
- `user_id` (VARCHAR): Foreign key to users
- `platform` (VARCHAR): Platform name
- `wallet_address` (TEXT): Blockchain address
- `is_primary` (BOOLEAN): Primary wallet for this platform
- `is_verified` (BOOLEAN): Whether wallet ownership is verified
- `created_at`, `updated_at` (TIMESTAMP)
- UNIQUE constraint on (platform, wallet_address)

#### Trading

**user_orders**
- `id` (UUID): Primary key
- `user_id` (VARCHAR): Foreign key to users
- `platform` (TEXT): Execution platform
- `market_id` (TEXT): Platform-specific market ID
- `event_fingerprint` (TEXT): Link to aggregated event
- `side` (TEXT): 'buy' or 'sell'
- `outcome` (TEXT): Outcome being traded
- `outcome_index` (INTEGER): Outcome index
- `price` (NUMERIC): Order price
- `amount` (NUMERIC): Order amount in USD
- `order_type` (TEXT): 'market' or 'limit'
- `status` (TEXT): 'pending', 'submitted', 'filled', 'partial', 'cancelled', 'failed'
- `filled_amount` (NUMERIC): Amount filled
- `avg_fill_price` (NUMERIC): Average execution price
- `tx_hash` (TEXT): Blockchain transaction hash
- `venue_order_id` (TEXT): Order ID on the platform
- `error_message` (TEXT): Error if order failed
- `created_at`, `updated_at`, `filled_at` (TIMESTAMP)

**user_positions**
- `id` (UUID): Primary key
- `user_id` (VARCHAR): Foreign key to users
- `platform` (TEXT): Platform name
- `market_id` (TEXT): Market identifier
- `event_fingerprint` (TEXT): Link to aggregated event
- `outcome` (TEXT): Position outcome
- `outcome_index` (INTEGER): Outcome index
- `side` (TEXT): 'long' or 'short'
- `quantity` (NUMERIC): Position size
- `avg_entry_price` (NUMERIC): Average entry price
- `current_price` (NUMERIC): Current market price
- `unrealized_pnl` (NUMERIC): Unrealized profit/loss
- `realized_pnl` (NUMERIC): Realized profit/loss
- `total_cost` (NUMERIC): Total cost basis
- `created_at`, `updated_at` (TIMESTAMP)
- UNIQUE constraint on (user_id, platform, market_id, outcome, side)

#### Price Caching

**best_prices_cache**
- `event_fingerprint` (TEXT): Primary key
- `event_title` (TEXT): Event name
- `best_yes_price` (NUMERIC): Best price to buy "Yes"
- `best_yes_platform` (TEXT): Platform with best "Yes" price
- `best_yes_market_id` (TEXT): Market ID for best "Yes" price
- `best_no_price` (NUMERIC): Best price to buy "No"
- `best_no_platform` (TEXT): Platform with best "No" price
- `best_no_market_id` (TEXT): Market ID for best "No" price
- `last_updated` (TIMESTAMP): Cache update time
- `expires_at` (TIMESTAMP): Cache expiration time

#### Arbitrage

**arbitrage_alerts**
- `id` (UUID): Primary key
- `event_fingerprint` (TEXT): Event being arbitraged
- `event_title` (TEXT): Event name
- `opportunity_type` (TEXT): 'cross_platform' or 'same_platform'
- `profit_pct` (NUMERIC): Expected profit percentage
- `profit_amount_usd` (NUMERIC): Expected profit in USD
- `buy_platform` (TEXT): Where to buy
- `buy_market_id` (TEXT): Market to buy on
- `buy_outcome` (TEXT): Outcome to buy
- `buy_price` (NUMERIC): Purchase price
- `sell_platform` (TEXT): Where to sell
- `sell_market_id` (TEXT): Market to sell on
- `sell_outcome` (TEXT): Outcome to sell
- `sell_price` (NUMERIC): Sell price
- `min_capital_required` (NUMERIC): Minimum capital needed
- `detected_at` (TIMESTAMP): When opportunity was found
- `expires_at` (TIMESTAMP): When opportunity expires
- `status` (TEXT): 'active', 'executed', 'expired', 'cancelled'
- `executed_by` (VARCHAR): User who executed it
- `executed_at` (TIMESTAMP): Execution time

#### Copy Trading

**leaders**
- `leader_id` (VARCHAR): Primary key
- `wallet_address` (TEXT): Blockchain address (unique)
- `platform` (TEXT): Trading platform
- `name` (VARCHAR): Display name
- `bio` (TEXT): Biography
- `avatar_url` (TEXT): Profile picture URL
- `is_verified` (BOOLEAN): Verified status
- `is_active` (BOOLEAN): Active status
- `followers_count` (INTEGER): Number of followers
- `created_at`, `updated_at` (TIMESTAMP)

**leader_stats**
- `leader_id` (VARCHAR): Primary key, foreign key to leaders
- `total_trades` (INTEGER): Total trades
- `win_count` (INTEGER): Winning trades
- `loss_count` (INTEGER): Losing trades
- `total_volume` (NUMERIC): Total volume
- `pnl_7d` (NUMERIC): 7-day P&L
- `pnl_30d` (NUMERIC): 30-day P&L
- `pnl_all_time` (NUMERIC): All-time P&L
- `win_rate` (NUMERIC): Win rate percentage
- `avg_position_size` (NUMERIC): Average position size
- `largest_win` (NUMERIC): Largest winning trade
- `largest_loss` (NUMERIC): Largest losing trade
- `sharpe_ratio` (NUMERIC): Risk-adjusted returns
- `last_trade_at` (TIMESTAMP): Last trade timestamp
- `last_updated` (TIMESTAMP): Stats update time

**follows**
- `follow_id` (VARCHAR): Primary key
- `user_id` (VARCHAR): Foreign key to users
- `leader_id` (VARCHAR): Foreign key to leaders
- `base_allocation_usdc` (DOUBLE): Total capital allocated
- `max_utilization_pct` (DOUBLE): Max % of capital to use
- `max_per_trade_pct` (DOUBLE): Max % per trade
- `slippage_bps` (INTEGER): Allowed slippage in basis points
- `auto_close_with_leader` (BOOLEAN): Close positions when leader does
- `status` (VARCHAR): 'active', 'paused', 'stopped'
- `utilized_usdc` (DOUBLE): Currently used capital
- `total_pnl` (DOUBLE): Total profit/loss from copy trading
- `created_at`, `updated_at` (TIMESTAMP)
- UNIQUE constraint on (user_id, leader_id)

**replication_jobs**
- `job_id` (VARCHAR): Primary key
- `follow_id` (VARCHAR): Foreign key to follows
- `user_id` (VARCHAR): User placing the order
- `leader_id` (VARCHAR): Leader being copied
- `venue` (VARCHAR): Platform
- `market_id` (VARCHAR): Market identifier
- `side` (VARCHAR): 'buy' or 'sell'
- `outcome` (TEXT): Outcome being traded
- `size_usdc` (DOUBLE): Order size
- `slippage_bps` (INTEGER): Allowed slippage
- `status` (VARCHAR): 'pending', 'processing', 'filled', 'partial', 'skipped', 'failed'
- `filled_usdc` (DOUBLE): Amount filled
- `avg_price` (DOUBLE): Average fill price
- `venue_order_id` (VARCHAR): External order ID
- `tx_hash` (VARCHAR): Transaction hash
- `reason` (TEXT): Reason if skipped/failed
- `created_at`, `completed_at` (TIMESTAMP)

#### Miscellaneous

**user_activity**
- `id` (UUID): Primary key
- `user_id` (VARCHAR): Foreign key to users
- `activity_type` (TEXT): Type of activity
- `description` (TEXT): Human-readable description
- `metadata` (JSONB): Additional data
- `created_at` (TIMESTAMP)

**idempotency_keys**
- `key` (VARCHAR): Primary key
- `created_at` (TIMESTAMP)

#### Views

**active_arbitrage_opportunities**: Active arbitrage alerts
**user_portfolio_summary**: User portfolio aggregations

---

## Development Guide

### Running Tests

Currently, the project does not have extensive test coverage. To add tests:

**Backend:**
```bash
cd backend/services/server
cargo test

cd ../indexer
cargo test
```

**Frontend:**
```bash
cd frontend/web
npm test
```

### Adding New Market Sources

To add a new prediction market platform:

#### 1. Update Indexer

**Create a new source file:**
`backend/services/indexer/src/sources/yourplatform.rs`

```rust
use async_trait::async_trait;
use crate::model::Market;
use anyhow::Result;

pub struct YourPlatformSource {
    client: reqwest::Client,
    api_url: String,
}

impl YourPlatformSource {
    pub fn new(api_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_url,
        }
    }
}

#[async_trait]
impl MarketSource for YourPlatformSource {
    async fn fetch_markets(&self) -> Result<Vec<Market>> {
        // Implement API call to fetch markets
        // Transform response to Market struct
        todo!()
    }
    
    fn source_name(&self) -> &str {
        "yourplatform"
    }
}
```

**Register the source:**
`backend/services/indexer/src/sources/mod.rs`

```rust
mod yourplatform;
pub use yourplatform::YourPlatformSource;
```

**Add to pipeline:**
`backend/services/indexer/src/pipeline.rs`

```rust
let yourplatform_source = YourPlatformSource::new("https://api.yourplatform.com".to_string());
sources.push(Box::new(yourplatform_source));
```

#### 2. Update Order Executor

**Create an executor:**
`backend/services/server/src/order_executor/yourplatform_executor.rs`

```rust
use async_trait::async_trait;
use crate::order_executor::executor_trait::{OrderExecutor, ExecutionResult};
use crate::models::PlaceOrderRequest;
use anyhow::Result;

pub struct YourPlatformExecutor {
    api_url: String,
    api_key: String,
}

#[async_trait]
impl OrderExecutor for YourPlatformExecutor {
    async fn place_order(&self, request: &PlaceOrderRequest, wallet_address: &str) -> Result<ExecutionResult> {
        // Implement order placement
        todo!()
    }
    
    async fn cancel_order(&self, order_id: &str) -> Result<()> {
        // Implement order cancellation
        todo!()
    }
    
    fn platform_name(&self) -> &str {
        "yourplatform"
    }
}
```

**Register the executor:**
`backend/services/server/src/order_executor/router.rs`

```rust
match platform {
    "yourplatform" => {
        let executor = YourPlatformExecutor::new(/* ... */);
        executor.place_order(request, wallet_address).await
    },
    // ... other platforms
}
```

### Extending the API

To add a new API endpoint:

#### 1. Define Request/Response Types

`backend/services/server/src/models.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YourRequest {
    pub field1: String,
    pub field2: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YourResponse {
    pub result: String,
}
```

#### 2. Create Handler

`backend/services/server/src/handlers.rs`

```rust
pub async fn your_handler(
    State(state): State<AppState>,
    Json(request): Json<YourRequest>,
) -> Result<Json<YourResponse>, ApiError> {
    // Your logic here
    let result = process_request(&request);
    
    Ok(Json(YourResponse {
        result,
    }))
}
```

#### 3. Register Route

`backend/services/server/src/routes.rs`

```rust
Router::new()
    .route("/your-endpoint", post(your_handler))
    // ... other routes
```

#### 4. Update Frontend

**Add type:**
`frontend/web/src/lib/api/types.ts`

```typescript
export interface YourRequest {
  field1: string;
  field2: number;
}

export interface YourResponse {
  result: string;
}
```

**Add hook:**
`frontend/web/src/lib/api/use-your-feature.ts`

```typescript
import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';
import { YourRequest, YourResponse } from './types';

export function useYourFeature() {
  return useMutation({
    mutationFn: async (request: YourRequest) => {
      return apiClient.post<YourResponse>('/your-endpoint', request);
    },
  });
}
```

### Frontend Component Structure

```
frontend/web/src/
├── app/                      # Next.js pages (App Router)
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Homepage
│   ├── markets/             # Market pages
│   ├── arbitrage/           # Arbitrage pages
│   └── orders/              # Order management pages
│
├── components/              # React components
│   ├── markets/            # Market-related components
│   ├── arbitrage/          # Arbitrage components
│   ├── orders/             # Order components
│   └── copy-trading/       # Copy trading components
│
├── lib/                    # Utilities and API
│   └── api/               # API client and hooks
│       ├── client.ts      # Axios client
│       ├── types.ts       # TypeScript types
│       ├── query-keys.ts  # React Query keys
│       └── use-*.ts       # Custom hooks
│
└── providers/             # Context providers
    └── query-provider.tsx # React Query provider
```

---

## Troubleshooting

### Database Connection Issues

**Problem:** Cannot connect to PostgreSQL

**Solutions:**
1. Verify PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   # or
   brew services list
   ```

2. Check connection string format:
   ```
   postgres://username:password@host:port/database
   ```

3. Verify database exists:
   ```bash
   psql -U postgres -l
   ```

4. Check PostgreSQL logs:
   ```bash
   sudo tail -f /var/log/postgresql/postgresql-*.log
   ```

5. Verify firewall settings (especially on production):
   ```bash
   sudo ufw status
   ```

---

### CORS Errors

**Problem:** Browser blocks API requests due to CORS

**Solutions:**
1. Check `ALLOWED_ORIGINS` environment variable in server config

2. For development, use wildcard:
   ```bash
   ALLOWED_ORIGINS=*
   ```

3. For production, specify exact origins:
   ```bash
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

4. Verify CORS headers in browser DevTools Network tab

---

### Authentication Errors

**Problem:** 401 Unauthorized errors

**Solutions:**
1. Verify JWT token is being sent:
   ```bash
   curl -v http://localhost:8080/orders/my \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. Check token hasn't expired (default: 24 hours)

3. Verify `JWT_SECRET` matches between registration and validation

4. Clear localStorage and re-login:
   ```javascript
   localStorage.removeItem('auth_token');
   ```

---

### Missing Dependencies

**Problem:** Compilation errors due to missing crates

**Solution:**
```bash
cd backend/services/server
cargo clean
cargo update
cargo build
```

For frontend:
```bash
cd frontend/web
rm -rf node_modules package-lock.json
npm install
```

---

### Port Conflicts

**Problem:** Address already in use

**Solutions:**
1. Find process using the port:
   ```bash
   # Linux/Mac
   lsof -i :8080
   
   # Windows
   netstat -ano | findstr :8080
   ```

2. Kill the process:
   ```bash
   kill -9 <PID>
   ```

3. Or change the port in `.env`:
   ```bash
   SERVER_PORT=8081
   ```

---

### Slow API Responses

**Problem:** API takes too long to respond

**Solutions:**
1. Check background task intervals:
   ```bash
   CACHE_REFRESH_INTERVAL_SECONDS=60  # Increase if too frequent
   ARBITRAGE_SCAN_INTERVAL_SECONDS=30
   ```

2. Add database indexes (already in schema):
   ```sql
   CREATE INDEX IF NOT EXISTS idx_user_orders_user_id ON user_orders(user_id);
   ```

3. Monitor database query performance:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM user_orders WHERE user_id = 'user_123';
   ```

4. Check network latency to external APIs

---

### Indexer Not Fetching Data

**Problem:** No market data appearing in database

**Solutions:**
1. Check indexer logs:
   ```bash
   RUST_LOG=indexer=debug cargo run
   ```

2. Verify API keys for platforms that require authentication:
   ```bash
   KALSHI_API_KEY=your_key
   KALSHI_API_SECRET=your_secret
   ```

3. Check rate limiting:
   ```bash
   MAX_REQUESTS_PER_MINUTE=100
   ```

4. Verify network connectivity to external APIs:
   ```bash
   curl https://clob.polymarket.com/markets
   ```

---

### Frontend Build Errors

**Problem:** Next.js build fails

**Solutions:**
1. Clear Next.js cache:
   ```bash
   rm -rf .next
   npm run build
   ```

2. Check TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

3. Verify environment variables:
   ```bash
   cat .env.local
   ```

4. Check Node version (requires 20+):
   ```bash
   node --version
   ```

---

## Support & Contributing

### Getting Help

- Check this documentation first
- Review error logs carefully
- Search existing issues on GitHub (when available)

### Contributing

To contribute to Octamarket:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style

**Rust:**
- Use `cargo fmt` before committing
- Run `cargo clippy` for linting
- Follow Rust naming conventions

**TypeScript:**
- Use ESLint configuration provided
- Follow React best practices
- Use TypeScript strictly

---

## License

This project is proprietary. All rights reserved.

---

## Changelog

### Version 0.1.0 (Current)

**Features:**
- Multi-platform market aggregation
- Event fingerprinting and deduplication
- Wallet tracking and analytics
- Best price discovery
- Arbitrage detection
- Order execution (Polymarket)
- JWT authentication
- User wallet management
- REST API with 23 endpoints
- React Query frontend integration
- Real-time background tasks

**Known Limitations:**
- Copy trading is stub implementation
- Order execution only supports Polymarket
- No real-time WebSocket updates
- Limited test coverage

**Planned for Future Releases:**
- Full copy trading implementation
- More platform integrations (Augur, Kalshi, Thales, Omen)
- WebSocket support for real-time updates
- Advanced analytics and charting
- Mobile app
- Notification system
- Social features

---

**Last Updated:** January 2025  
**Document Version:** 1.0

