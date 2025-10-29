# OctaMarkets API Quick Reference

## Base URL
```
http://localhost:3001
```

## Authentication
```bash
# Register
curl -X POST "http://localhost:3001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'

# Login
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "password123"}'

# Use token
curl "http://localhost:3001/api/auth/me" \
  -H "Authorization: Bearer <token>"
```

## Markets

### List Markets
```bash
# Basic
curl "http://localhost:3001/api/markets"

# With filters
curl "http://localhost:3001/api/markets?status=ACTIVE&source=POLYMARKET&page=1&limit=10"

# Search
curl "http://localhost:3001/api/markets?search=COVID&page=1&limit=5"

# Sort by volume
curl "http://localhost:3001/api/markets?sortBy=volume&sortOrder=desc"
```

### Market Details
```bash
# Get market by ID
curl "http://localhost:3001/api/markets/<market-id>"

# Get market outcomes
curl "http://localhost:3001/api/markets/<market-id>/outcomes"

# Get price history
curl "http://localhost:3001/api/markets/<market-id>/price-history"
```

### Market Categories
```bash
# Get categories
curl "http://localhost:3001/api/markets/categories"

# Get tags
curl "http://localhost:3001/api/markets/tags"

# Active markets
curl "http://localhost:3001/api/markets/active"

# Trending markets
curl "http://localhost:3001/api/markets/trending"
```

## Traders

### List Traders
```bash
# Basic
curl "http://localhost:3001/api/traders"

# Top traders by PnL
curl "http://localhost:3001/api/traders?sortBy=totalPnl&sortOrder=desc"

# Search traders
curl "http://localhost:3001/api/traders?search=JustWakingUp"

# Filter by source
curl "http://localhost:3001/api/traders?source=POLYMARKET"
```

### Trader Details
```bash
# Get trader by ID
curl "http://localhost:3001/api/traders/<trader-id>"

# Get trader stats
curl "http://localhost:3001/api/traders/<trader-id>/stats"

# Get trader trades
curl "http://localhost:3001/api/traders/<trader-id>/trades"

# Get trader followers
curl "http://localhost:3001/api/traders/<trader-id>/followers"
```

### Copy Trading Traders
```bash
# Get copy trading traders
curl "http://localhost:3001/api/traders/copy-trading"
```

## Leaderboard

### Global Leaderboard
```bash
# Basic leaderboard
curl "http://localhost:3001/api/leaderboard"

# With filters
curl "http://localhost:3001/api/leaderboard?source=POLYMARKET&timeframe=24h"

# Top traders
curl "http://localhost:3001/api/leaderboard/top"

# Rising traders
curl "http://localhost:3001/api/leaderboard/rising"
```

### Source Leaderboards
```bash
# Polymarket leaderboard
curl "http://localhost:3001/api/leaderboard/POLYMARKET"

# Kalshi leaderboard
curl "http://localhost:3001/api/leaderboard/KALSHI"
```

### Historical Data
```bash
# Leaderboard snapshots
curl "http://localhost:3001/api/leaderboard/snapshots?source=POLYMARKET"
```

## Statistics

### Platform Stats
```bash
# Overall platform stats
curl "http://localhost:3001/api/stats/platform"

# Market stats
curl "http://localhost:3001/api/stats/markets"

# Source stats
curl "http://localhost:3001/api/stats/sources"

# Trader stats
curl "http://localhost:3001/api/stats/traders"

# Leaderboard stats
curl "http://localhost:3001/api/stats/leaderboard"
```

## Copy Trading (Requires Auth)

### Follow/Unfollow
```bash
# Follow a trader
curl -X POST "http://localhost:3001/api/copy-trading/follow" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"traderId": "<trader-id>", "autoCopyTrades": true, "maxCopyAmount": 1000}'

# Unfollow a trader
curl -X DELETE "http://localhost:3001/api/copy-trading/unfollow/<trader-id>" \
  -H "Authorization: Bearer <token>"
```

### Settings
```bash
# Update copy settings
curl -X PATCH "http://localhost:3001/api/copy-trading/settings/<follow-id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"autoCopyTrades": false, "maxCopyAmount": 2000}'

# Get my follows
curl "http://localhost:3001/api/copy-trading/my-follows" \
  -H "Authorization: Bearer <token>"

# Get copy trading stats
curl "http://localhost:3001/api/copy-trading/stats" \
  -H "Authorization: Bearer <token>"
```

## Health Check
```bash
# Server info
curl "http://localhost:3001/"

# Health check
curl "http://localhost:3001/health"
```

## Common Query Parameters

### Pagination
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

### Sorting
- `sortBy`: Field to sort by
- `sortOrder`: `asc` or `desc`

### Filtering
- `status`: Market status (ACTIVE, RESOLVED, CANCELLED, PAUSED)
- `source`: Source (POLYMARKET, KALSHI, AUGUR, THALES, OMEN)
- `category`: Market category
- `tags`: Comma-separated tags
- `search`: Search term
- `timeframe`: Time period (1h, 24h, 7d, 30d, all)

## Response Format
```json
{
  "success": boolean,
  "data": any,
  "error": {
    "message": string,
    "code": string,
    "details": any
  },
  "meta": {
    "page": number,
    "limit": number,
    "total": number,
    "hasMore": boolean
  }
}
```

## Rate Limits
- General: 100 requests per 15 minutes
- Auth: 5 attempts per 15 minutes
- Copy Trading: 3 attempts per minute

## Error Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Validation Error
- `429`: Rate Limit Exceeded
- `500`: Internal Server Error
