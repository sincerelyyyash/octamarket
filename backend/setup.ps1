# Opinion Markets Setup Script (PowerShell)
# This script sets up the indexer and server services with PostgreSQL

param(
    [switch]$SkipBuild,
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Opinion Markets (Indexer + Server)..." -ForegroundColor Blue

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Magenta
}

# Check if Docker is installed
try {
    $dockerVersion = docker --version 2>$null
    if (-not $dockerVersion) {
        throw "Docker not found"
    }
    Write-Success "Docker is installed: $dockerVersion"
} catch {
    Write-Error "Docker is not installed. Please install Docker Desktop first."
    Write-Host "Download from: https://www.docker.com/products/docker-desktop"
    exit 1
}

# Check if Docker Compose is available
try {
    $composeVersion = docker-compose --version 2>$null
    if (-not $composeVersion) {
        # Try new Docker Compose command
        $composeVersion = docker compose version 2>$null
        if (-not $composeVersion) {
            throw "Docker Compose not found"
        }
    }
    Write-Success "Docker Compose is available: $composeVersion"
} catch {
    Write-Error "Docker Compose is not available. Please install Docker Compose."
    exit 1
}

# Check if Rust is installed (for local development)
try {
    $rustVersion = cargo --version 2>$null
    if ($rustVersion) {
        Write-Success "Rust is installed: $rustVersion"
    } else {
        Write-Warning "Rust is not installed. You'll need it for local development."
        Write-Status "Install Rust from: https://rustup.rs/"
    }
} catch {
    Write-Warning "Rust is not installed. You'll need it for local development."
    Write-Status "Install Rust from: https://rustup.rs/"
}

Write-Step "1. Stopping any existing containers..."
try {
    docker-compose down 2>$null
    Write-Success "Stopped existing containers"
} catch {
    Write-Status "No existing containers to stop"
}

Write-Step "2. Building and starting all services..."
if ($SkipBuild) {
    Write-Status "Skipping build step..."
    docker-compose up -d
} else {
    docker-compose up -d --build
}

Write-Step "3. Waiting for database to be ready..."
$timeout = 120
$counter = 0
$databaseReady = $false

while ($counter -lt $timeout) {
    try {
        $result = docker-compose exec postgres pg_isready -U postgres -d opinion_markets 2>$null
        if ($LASTEXITCODE -eq 0) {
            $databaseReady = $true
            break
        }
    } catch {
        # Continue waiting
    }
    
    Start-Sleep -Seconds 2
    $counter += 2
    Write-Host "." -NoNewline
}

Write-Host ""

if ($databaseReady) {
    Write-Success "Database is ready!"
} else {
    Write-Error "Database failed to start within $timeout seconds"
    exit 1
}

Write-Step "4. Waiting for services to be healthy..."
Start-Sleep -Seconds 10

# Check if services are running
Write-Step "5. Checking service status..."

# Check database
try {
    $dbTest = docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✅ Database is healthy"
    } else {
        Write-Error "❌ Database is not responding"
    }
} catch {
    Write-Error "❌ Database is not responding"
}

# Check if indexer is running
try {
    $indexerStatus = docker-compose ps indexer 2>$null
    if ($indexerStatus -match "Up") {
        Write-Success "✅ Indexer service is running"
    } else {
        Write-Warning "⚠️  Indexer service is not running"
    }
} catch {
    Write-Warning "⚠️  Indexer service is not running"
}

# Check if server is running
try {
    $serverStatus = docker-compose ps server 2>$null
    if ($serverStatus -match "Up") {
        Write-Success "✅ Server service is running"
    } else {
        Write-Warning "⚠️  Server service is not running"
    }
} catch {
    Write-Warning "⚠️  Server service is not running"
}

Write-Step "6. Testing unified database schema..."
try {
    $schemaTest = docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT COUNT(*) FROM aggregated_events;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✅ Unified database schema is properly initialized"
        
        # Show sample data
        Write-Status "Sample data in database:"
        Write-Host "📊 Aggregated Events:" -ForegroundColor Cyan
        docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT event_fingerprint, title, status FROM aggregated_events LIMIT 3;"
        Write-Host ""
        Write-Host "👥 Leaders:" -ForegroundColor Cyan
        docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT leader_id, name, pnl7d, followers FROM leaders LIMIT 3;"
        Write-Host ""
        Write-Host "📈 Market Sources:" -ForegroundColor Cyan
        docker-compose exec postgres psql -U postgres -d opinion_markets -c "SELECT source, market_id, name FROM market_sources LIMIT 3;"
    } else {
        Write-Error "❌ Unified database schema test failed!"
        exit 1
    }
} catch {
    Write-Error "❌ Unified database schema test failed!"
    exit 1
}

Write-Step "7. Testing API endpoints..."

# Test server health endpoint
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 10 2>$null
    if ($healthResponse.StatusCode -eq 200) {
        Write-Success "✅ Server API is responding"
        Write-Host "🌐 Server Health Check:" -ForegroundColor Cyan
        try {
            $healthJson = $healthResponse.Content | ConvertFrom-Json
            $healthJson | ConvertTo-Json -Depth 3
        } catch {
            Write-Host $healthResponse.Content
        }
        Write-Host ""
    } else {
        Write-Warning "⚠️  Server API returned status: $($healthResponse.StatusCode)"
    }
} catch {
    Write-Warning "⚠️  Server API is not responding (this is normal if server is still starting)"
}

# Test server metrics endpoint
try {
    $metricsResponse = Invoke-WebRequest -Uri "http://localhost:3000/metrics" -UseBasicParsing -TimeoutSec 10 2>$null
    if ($metricsResponse.StatusCode -eq 200) {
        Write-Success "✅ Server metrics endpoint is available"
        Write-Host "📈 Server Metrics:" -ForegroundColor Cyan
        try {
            $metricsJson = $metricsResponse.Content | ConvertFrom-Json
            $metricsJson | ConvertTo-Json -Depth 3
        } catch {
            Write-Host $metricsResponse.Content
        }
        Write-Host ""
    } else {
        Write-Warning "⚠️  Server metrics endpoint returned status: $($metricsResponse.StatusCode)"
    }
} catch {
    Write-Warning "⚠️  Server metrics endpoint is not responding"
}

Write-Success "🎉 Opinion Markets setup complete!"

Write-Host ""
Write-Status "📋 Service Information:"
Write-Host "  🗄️  Database:" -ForegroundColor Yellow
Write-Host "    - Host: localhost"
Write-Host "    - Port: 5432"
Write-Host "    - Database: opinion_markets"
Write-Host "    - Username: postgres"
Write-Host "    - Password: postgres"
Write-Host "    - Connection URL: postgres://postgres:postgres@localhost:5432/opinion_markets"
Write-Host ""
Write-Host "  🚀 Server API:" -ForegroundColor Yellow
Write-Host "    - URL: http://localhost:3000"
Write-Host "    - Health: http://localhost:3000/health"
Write-Host "    - Metrics: http://localhost:3000/metrics"
Write-Host "    - API Docs: http://localhost:3000/docs (if available)"
Write-Host ""
Write-Host "  📊 Indexer Service:" -ForegroundColor Yellow
Write-Host "    - Status: Running in background"
Write-Host "    - Logs: docker-compose logs indexer"
Write-Host ""

Write-Status "🔧 Development Commands:"
Write-Host "  View logs:"
Write-Host "    docker-compose logs -f                    # All services"
Write-Host "    docker-compose logs -f server             # Server only"
Write-Host "    docker-compose logs -f indexer           # Indexer only"
Write-Host "    docker-compose logs -f postgres          # Database only"
Write-Host ""
Write-Host "  Stop services:"
Write-Host "    docker-compose down                       # Stop all"
Write-Host "    docker-compose down -v                    # Stop and remove volumes"
Write-Host ""
Write-Host "  Restart services:"
Write-Host "    docker-compose restart                    # Restart all"
Write-Host "    docker-compose restart server             # Restart server only"
Write-Host "    docker-compose restart indexer            # Restart indexer only"
Write-Host ""
Write-Host "  Database management:"
Write-Host "    docker-compose exec postgres psql -U postgres -d opinion_markets"
Write-Host "    docker-compose exec postgres pg_dump -U postgres opinion_markets > backup.sql"
Write-Host ""

Write-Status "🧪 Testing Commands:"
Write-Host "  Test database connection:"
Write-Host "    docker-compose exec postgres psql -U postgres -d opinion_markets"
Write-Host ""
Write-Host "  Test API endpoints:"
Write-Host "    Invoke-WebRequest http://localhost:3000/health"
Write-Host "    Invoke-WebRequest http://localhost:3000/metrics"
Write-Host "    Invoke-WebRequest http://localhost:3000/events"
Write-Host "    Invoke-WebRequest http://localhost:3000/leaders"
Write-Host ""

Write-Status "📁 Local Development:"
Write-Host "  For local development without Docker:"
Write-Host "    `$env:DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/opinion_markets'"
Write-Host "    cd services/indexer; cargo run"
Write-Host "    cd services/server; cargo run"
Write-Host ""

Write-Warning "⚠️  Important Notes:"
Write-Host "  - Database uses unified schema for both indexer and server services"
Write-Host "  - All tables are initialized from ./database/init.sql"
Write-Host "  - Change JWT_SECRET in production"
Write-Host "  - Update ALLOWED_ORIGINS for CORS in production"
Write-Host "  - Use proper database credentials in production"
Write-Host "  - Monitor logs for any issues"
Write-Host ""

Write-Success "Setup complete! Happy coding! 🚀"
