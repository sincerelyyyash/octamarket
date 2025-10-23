#!/bin/bash

# Copy Trading Server Setup Script

echo "🚀 Setting up Copy Trading Server..."

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Start PostgreSQL
echo "🐘 Starting PostgreSQL..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    sleep 1
done

# Run migrations (schema is auto-loaded via docker-compose)
echo "✅ Database schema initialized"

# Build the server
echo "🔨 Building the server..."
cd ../../..
cargo build --bin server

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start the server, run:"
echo "  cd backend/services/server"
echo "  cargo run --bin server"
echo ""
echo "Or in release mode:"
echo "  cargo run --bin server --release"
echo ""
echo "The server will be available at: http://localhost:8080"
echo "Health check: http://localhost:8080/health"
echo ""
echo "To stop PostgreSQL:"
echo "  docker-compose down"

