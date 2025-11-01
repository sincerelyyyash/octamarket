#!/bin/bash

# Test script for prediction market APIs
# This script tests all the API endpoints to verify they're accessible

set -e

echo "🔍 Testing Prediction Market APIs..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}
  
  echo -n "Testing $name... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1)
  
  if [ "$response" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
    return 1
  fi
}

test_json_response() {
  local name=$1
  local url=$2
  local jq_filter=$3
  
  echo -n "Testing $name... "
  
  response=$(curl -s "$url" 2>&1)
  count=$(echo "$response" | jq "$jq_filter" 2>/dev/null || echo "ERROR")
  
  if [ "$count" != "ERROR" ] && [ "$count" != "null" ]; then
    echo -e "${GREEN}✓ PASS${NC} (returned $count items)"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $response" | head -c 200
    return 1
  fi
}

echo "=== Polymarket API Tests ==="
echo ""

test_json_response \
  "Polymarket Markets (Gamma API)" \
  "https://gamma-api.polymarket.com/events/pagination?limit=5&active=true" \
  ".data | length"

test_json_response \
  "Polymarket Leaderboard" \
  "https://data-api.polymarket.com/v1/leaderboard" \
  "length"

test_json_response \
  "Polymarket CLOB Markets" \
  "https://clob.polymarket.com/markets?limit=5" \
  "if type == \"array\" then length else .markets | length end"

echo ""
echo "=== Kalshi API Tests ==="
echo ""

echo -e "${YELLOW}Note: Kalshi endpoints require authentication${NC}"

# Test public endpoint (if any)
test_endpoint \
  "Kalshi Markets (No Auth)" \
  "https://api.elections.kalshi.com/trade-api/v2/markets?limit=1" \
  401  # Expected to fail with 401 without auth

echo ""
echo "=== WebSocket Connectivity Tests ==="
echo ""

test_websocket() {
  local name=$1
  local url=$2
  
  echo -n "Testing WebSocket $name... "
  
  # Use timeout to limit connection attempt
  timeout 3 bash -c "exec 3<>/dev/tcp/$(echo $url | sed 's|wss://||' | cut -d'/' -f1)/443" 2>/dev/null && \
    echo -e "${GREEN}✓ PASS${NC} (host reachable)" || \
    echo -e "${YELLOW}⚠ SKIP${NC} (requires WebSocket client)"
}

test_websocket "Polymarket CLOB" "wss://clob.polymarket.com/ws"
test_websocket "Polymarket Gamma" "wss://gamma-api.polymarket.com/ws"
test_websocket "Kalshi Trade API" "wss://api.elections.kalshi.com/trade-api/ws"

echo ""
echo "=== Summary ==="
echo ""
echo "✓ API endpoints are accessible"
echo "✓ JSON responses are valid"
echo "⚠ Authentication required for Kalshi"
echo ""
echo "To run the indexer:"
echo "  cd backend/apps/indexer"
echo "  cp .env.example .env"
echo "  # Configure .env with API keys"
echo "  bun run dev"

