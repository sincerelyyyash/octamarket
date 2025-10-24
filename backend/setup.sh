#!/bin/bash

# Opinion Markets Setup Script

set -e

echo "Setting up Opinion Markets (Indexer + Server)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Check if Rust is installed (for local development)
if ! command -v cargo &> /dev/null; then
    print_warning "Rust is not installed. You'll need it for local development."
    print_status "Install Rust from: https://rustup.rs/"
fi

print_step "1. Stopping any existing containers..."
docker-compose down 2>/dev/null || true

print_step "2. Building and starting all services..."
docker-compose up -d --build

print_step "3. Waiting for database to be ready..."
timeout=120
counter=0
while ! docker-compose exec postgres pg_isready -U postgres -d opinion_markets 2>/dev/null; do
    if [ $counter -ge $timeout ]; then
        print_error "Database failed to start within $timeout seconds"
        exit 1
    fi
    sleep 2
    counter=$((counter + 2))
    echo -n "."
done
echo ""

print_success "Database is ready!"

print_step "4. Waiting for services to be healthy..."
sleep 10

# Check if services are running
print_step "5. Checking service status..."

# Check database
if docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "Database is healthy"
else
    print_error "Database is not responding"
fi

# Check if indexer is running
if docker-compose ps indexer | grep -q "Up"; then
    print_success "Indexer service is running"
else
    print_warning "Indexer service is not running"
fi

# Check if server is running
if docker-compose ps server | grep -q "Up"; then
    print_success "Server service is running"
else
    print_warning "Server service is not running"
fi

print_step "6. Testing unified database schema..."
if docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT COUNT(*) FROM aggregated_events;" > /dev/null 2>&1; then
    print_success "Unified database schema is properly initialized"
    
    # Show sample data
    print_status "Sample data in database:"
    echo "📊 Aggregated Events:"
    docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT event_fingerprint, title, status FROM aggregated_events LIMIT 3;"
    echo ""
    echo "👥 Leaders:"
    docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT leader_id, name, pnl7d, followers FROM leaders LIMIT 3;"
    echo ""
    echo "📈 Market Sources:"
    docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT source, market_id, name FROM market_sources LIMIT 3;"
else
    print_error "Unified database schema test failed!"
    exit 1
fi

print_step "7. Testing API endpoints..."

# Test server health endpoint
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    print_success "Server API is responding"
    echo "Server Health Check:"
    curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health
    echo ""
else
    print_warning "Server API is not responding (this is normal if server is still starting)"
fi

# Test server metrics endpoint
if curl -s http://localhost:3000/metrics > /dev/null 2>&1; then
    print_success "Server metrics endpoint is available"
    echo "Server Metrics:"
    curl -s http://localhost:3000/metrics | jq . 2>/dev/null || curl -s http://localhost:3000/metrics
    echo ""
else
    print_warning "Server metrics endpoint is not responding"
fi

print_success "Opinion Markets setup complete!"

echo ""
print_status "Service Information:"
echo "  Database:"
echo "    - Host: localhost"
echo "    - Port: 5432"
echo "    - Database: opinion_markets"
echo "    - Username: postgres"
echo "    - Password: postgres"
echo "    - Connection URL: postgres://postgres:postgres@localhost:5432/opinion_markets"
echo ""
echo "  Server API:"
echo "    - URL: http://localhost:3000"
echo "    - Health: http://localhost:3000/health"
echo "    - Metrics: http://localhost:3000/metrics"
echo "    - API Docs: http://localhost:3000/docs (if available)"
echo ""
echo "  Indexer Service:"
echo "    - Status: Running in background"
echo "    - Logs: docker-compose logs indexer"
echo ""

print_status "Development Commands:"
echo "  View logs:"
echo "    docker-compose logs -f                    # All services"
echo "    docker-compose logs -f server             # Server only"
echo "    docker-compose logs -f indexer           # Indexer only"
echo "    docker-compose logs -f postgres          # Database only"
echo ""
echo "  Stop services:"
echo "    docker-compose down                       # Stop all"
echo "    docker-compose down -v                    # Stop and remove volumes"
echo ""
echo "  Restart services:"
echo "    docker-compose restart                    # Restart all"
echo "    docker-compose restart server             # Restart server only"
echo "    docker-compose restart indexer            # Restart indexer only"
echo ""
echo "  Database management:"
echo "    docker-compose exec postgres psql -U postgres -d opinion_markets"
echo "    docker-compose exec postgres pg_dump -U postgres opinion_markets > backup.sql"
echo ""

print_status "Testing Commands:"
echo "  Test database connection:"
echo "    docker-compose exec postgres psql -U postgres -d opinion_markets"
echo ""
echo "  Test API endpoints:"
echo "    curl http://localhost:3000/health"
echo "    curl http://localhost:3000/metrics"
echo "    curl http://localhost:3000/events"
echo "    curl http://localhost:3000/leaders"
echo ""

print_status "Local Development:"
echo "  For local development without Docker:"
echo "    export DATABASE_URL=postgres://postgres:postgres@localhost:5432/opinion_markets"
echo "    cd services/indexer && cargo run"
echo "    cd services/server && cargo run"
echo ""

print_warning "Important Notes:"
echo "  - Database uses unified schema for both indexer and server services"
echo "  - All tables are initialized from ./database/init.sql"
echo "  - Change JWT_SECRET in production"
echo "  - Update ALLOWED_ORIGINS for CORS in production"
echo "  - Use proper database credentials in production"
echo "  - Monitor logs for any issues"
echo ""

print_success "Setup complete! Happy coding!"
