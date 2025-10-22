#!/bin/bash

# Opinion Markets Indexer Database Setup Script
# This script sets up the PostgreSQL database using Docker

set -e

echo "🚀 Setting up Opinion Markets Indexer Database..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Stop any existing containers
print_status "Stopping any existing containers..."
docker-compose down 2>/dev/null || true

# Start the database container
print_status "Starting PostgreSQL database container..."
docker-compose up -d postgres

# Wait for database to be ready
print_status "Waiting for database to be ready..."
timeout=60
counter=0
while ! docker-compose exec postgres pg_isready -U postgres -d indexer 2>/dev/null; do
    if [ $counter -ge $timeout ]; then
        print_error "Database failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
    echo -n "."
done
echo ""

print_success "Database is ready!"

# Show database connection info
print_status "Database connection details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: indexer"
echo "  Username: postgres"
echo "  Password: postgres"
echo "  Connection URL: postgres://postgres:postgres@localhost:5432/indexer"

# Test database connection
print_status "Testing database connection..."
if docker-compose exec postgres psql -U postgres -d indexer -c "SELECT COUNT(*) FROM aggregated_events;" > /dev/null 2>&1; then
    print_success "Database connection test passed!"
    
    # Show sample data
    print_status "Sample data in database:"
    docker-compose exec postgres psql -U postgres -d indexer -c "SELECT event_fingerprint, title, status FROM aggregated_events LIMIT 5;"
else
    print_error "Database connection test failed!"
    exit 1
fi

print_success "Database setup complete! 🎉"
print_status "You can now run the indexer service with:"
echo "  export POSTGRES_URL=postgres://postgres:postgres@localhost:5432/indexer"
echo "  cd backend/services/indexer && cargo run"
