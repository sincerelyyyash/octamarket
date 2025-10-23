# Copy Trading Server Setup Script for Windows

Write-Host "🚀 Setting up Copy Trading Server..." -ForegroundColor Cyan

# Check if docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    Copy-Item env.example .env
    Write-Host "✅ .env file created" -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Start PostgreSQL
Write-Host "🐘 Starting PostgreSQL..." -ForegroundColor Yellow
docker-compose up -d

# Wait for PostgreSQL to be ready
Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
for ($i = 1; $i -le $maxAttempts; $i++) {
    $result = docker-compose exec -T postgres pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL is ready!" -ForegroundColor Green
        break
    }
    if ($i -eq $maxAttempts) {
        Write-Host "❌ PostgreSQL failed to start" -ForegroundColor Red
        exit 1
    }
    Start-Sleep -Seconds 1
}

# Database schema is auto-loaded via docker-compose
Write-Host "✅ Database schema initialized" -ForegroundColor Green

# Build the server
Write-Host "🔨 Building the server..." -ForegroundColor Yellow
Set-Location ..\..\..
cargo build --bin server

Write-Host ""
Write-Host "✨ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the server, run:" -ForegroundColor Cyan
Write-Host "  cd backend\services\server" -ForegroundColor White
Write-Host "  cargo run --bin server" -ForegroundColor White
Write-Host ""
Write-Host "Or in release mode:" -ForegroundColor Cyan
Write-Host "  cargo run --bin server --release" -ForegroundColor White
Write-Host ""
Write-Host "The server will be available at: http://localhost:8080" -ForegroundColor Yellow
Write-Host "Health check: http://localhost:8080/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop PostgreSQL:" -ForegroundColor Cyan
Write-Host "  docker-compose down" -ForegroundColor White

