# Opinion Markets Backend

A unified backend system for opinion markets that includes both data indexing and copy trading functionality.

## 🏗️ Architecture

This backend consists of two main services with a unified database:

- **Indexer Service**: Fetches and indexes market data from various prediction market platforms (Polymarket, Augur, Kalshi, Thales, Omen)
- **Server Service**: Provides REST API for copy trading functionality and market data access
- **Unified Database**: Single PostgreSQL database with schema for both services in `./database/init.sql`

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Rust (for local development)
- Git

### Setup

#### Option 1: Docker (Recommended)

**Linux/macOS:**
```bash
chmod +x setup.sh
./setup.sh
```

**Windows (PowerShell):**
```powershell
.\setup.ps1
```

#### Option 2: Manual Docker Setup

```bash
# Start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 3: Local Development

```bash
# Start database only
docker-compose up -d postgres

# Set environment variables
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/opinion_markets

# Run indexer
cd services/indexer
cargo run

# Run server (in another terminal)
cd services/server
cargo run
```

## 📊 Services

### Indexer Service
- **Purpose**: Fetches market data from prediction platforms
- **Port**: Internal (no external port)
- **Features**:
  - Real-time data fetching from multiple sources
  - Event fingerprinting for deduplication
  - Price history tracking
  - Health monitoring

### Server Service
- **Purpose**: REST API for copy trading and market data
- **Port**: 3000
- **Features**:
  - User authentication and authorization
  - Copy trading functionality
  - Market data API
  - Leader management
  - Order and position tracking

## 🗄️ Database

### Schema Overview

The unified database schema includes:

**Indexer Tables:**
- `aggregated_events`: Main events from all platforms
- `market_sources`: Market data from specific platforms
- `price_history`: Historical price data

**Server Tables:**
- `users`: User accounts
- `leaders`: Trading leaders
- `follows`: User-leader relationships
- `orders`: Trading orders
- `positions`: User positions
- `replication_jobs`: Copy trading jobs

### Database Connection

- **Host**: localhost
- **Port**: 5432
- **Database**: opinion_markets
- **Username**: postgres
- **Password**: postgres
- **URL**: `postgres://postgres:postgres@localhost:5432/opinion_markets`

## 🔌 API Endpoints

### Health & Monitoring
- `GET /health` - Service health check
- `GET /metrics` - Service metrics

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login

### Market Data
- `GET /events` - List all events
- `GET /events/{fingerprint}` - Get specific event
- `GET /markets` - List markets
- `GET /markets/{id}` - Get market details
- `GET /markets/{id}/price-history` - Price history
- `GET /markets/{id}/price-trends` - Price trends

### Copy Trading
- `GET /leaders` - List trading leaders
- `GET /leaders/{id}` - Get leader details
- `POST /follow` - Follow a leader
- `PATCH /follow/{id}` - Update follow settings
- `GET /follows/me` - Get user's follows
- `GET /positions` - Get user positions
- `GET /orders` - Get user orders

### System
- `POST /events/leader-trade` - Leader trade event (webhook)
- `GET /jobs/replications` - Get replication jobs
- `POST /jobs/replications/{id}/complete` - Complete job

## 🛠️ Development

### Project Structure

```
backend/
├── docker-compose.yml          # Unified Docker Compose
├── setup.sh                    # Unix/Linux setup script
├── setup.ps1                   # Windows PowerShell setup script
├── database/
│   └── init.sql                # Unified database schema
├── services/
│   ├── indexer/                # Indexer service
│   │   ├── Dockerfile
│   │   ├── Cargo.toml
│   │   └── src/
│   └── server/                  # Server service
│       ├── Dockerfile
│       ├── Cargo.toml
│       └── src/
```

### Environment Variables

#### Indexer Service
- `POSTGRES_URL`: Database connection string
- `KALSHI_API_KEY`: Kalshi API key (optional)
- `KALSHI_API_SECRET`: Kalshi API secret (optional)
- `RUST_LOG`: Log level (default: info)

#### Server Service
- `DATABASE_URL`: Database connection string
- `SERVER_HOST`: Server host (default: 0.0.0.0)
- `SERVER_PORT`: Server port (default: 3000)
- `JWT_SECRET`: JWT secret key
- `ALLOWED_ORIGINS`: CORS allowed origins
- `RUST_LOG`: Log level (default: info)

### Local Development Commands

```bash
# Start database
docker-compose up -d postgres

# Run indexer locally
cd services/indexer
export POSTGRES_URL=postgres://postgres:postgres@localhost:5432/opinion_markets
cargo run

# Run server locally
cd services/server
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/opinion_markets
export JWT_SECRET=your-secret-key
export ALLOWED_ORIGINS=*
cargo run
```

## 🧪 Testing

### Database Testing
```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d opinion_markets

# Check tables
\dt

# View sample data
SELECT * FROM aggregated_events LIMIT 5;
SELECT * FROM leaders LIMIT 5;
```

### API Testing
```bash
# Health check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics

# List events
curl http://localhost:3000/events

# List leaders
curl http://localhost:3000/leaders
```

## 📈 Monitoring

### Health Checks
- Database: `pg_isready` check
- Server: HTTP health endpoint
- Indexer: Internal health monitoring

### Metrics
- User count
- Active follows
- Pending jobs
- Database connection status

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f indexer
docker-compose logs -f postgres
```

## 🔧 Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check if PostgreSQL container is running: `docker-compose ps`
   - Verify database URL in environment variables
   - Check database logs: `docker-compose logs postgres`

2. **Server not responding**
   - Check server logs: `docker-compose logs server`
   - Verify port 3000 is not in use
   - Check environment variables

3. **Indexer not fetching data**
   - Check indexer logs: `docker-compose logs indexer`
   - Verify API keys for external services
   - Check database connectivity

### Reset Everything
```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove images (optional)
docker-compose down --rmi all

# Start fresh
./setup.sh
```

## 🚀 Production Deployment

### Security Considerations
- Change default JWT secret
- Use strong database passwords
- Configure proper CORS origins
- Enable HTTPS
- Use environment-specific configurations

### Performance Optimization
- Configure database connection pooling
- Set appropriate log levels
- Monitor resource usage
- Scale services as needed

### Backup Strategy
- Regular database backups
- Monitor disk space
- Test restore procedures

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Rust Documentation](https://doc.rust-lang.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Axum Web Framework](https://docs.rs/axum/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
