# OctaMarkets Express API Server

A comprehensive REST API server for OctaMarkets prediction market aggregator platform.

## Features

- **Markets API**: Browse, search, and filter prediction markets from multiple sources
- **Leaderboard API**: View trader rankings and performance metrics
- **Traders API**: Access trader profiles, stats, and trade history
- **Copy Trading Setup**: Follow traders and configure copy trading settings
- **Analytics & Stats**: Platform-wide statistics and insights
- **Authentication**: JWT-based user authentication with Web3 wallet support (coming soon)
- **Caching**: Redis-based caching for improved performance
- **Rate Limiting**: Built-in rate limiting for API protection

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile
- `PATCH /api/auth/profile` - Update user profile
- `POST /api/auth/wallet/connect` - Connect Web3 wallet (coming soon)

### Markets
- `GET /api/markets` - List markets (paginated, filterable, sortable, searchable)
- `GET /api/markets/:id` - Get market details
- `GET /api/markets/:id/outcomes` - Get market outcomes
- `GET /api/markets/:id/price-history` - Get price history
- `GET /api/markets/trending` - Get trending markets
- `GET /api/markets/active` - Get active markets
- `GET /api/markets/categories` - Get market categories
- `GET /api/markets/tags` - Get market tags

### Leaderboard
- `GET /api/leaderboard` - Get global leaderboard (aggregated)
- `GET /api/leaderboard/:source` - Get source-specific leaderboard
- `GET /api/leaderboard/snapshots` - Get historical snapshots

### Traders
- `GET /api/traders` - List traders (filterable, sortable)
- `GET /api/traders/:id` - Get trader details
- `GET /api/traders/:id/stats` - Get trader statistics
- `GET /api/traders/:id/trades` - Get trader trades (paginated)
- `GET /api/traders/:id/followers` - Get followers
- `GET /api/traders/:id/following` - Get following list
- `GET /api/traders/copy-trading` - Get traders available for copy trading

### Copy Trading
- `POST /api/copy-trading/follow` - Follow a trader (protected)
- `DELETE /api/copy-trading/unfollow/:traderId` - Unfollow (protected)
- `PATCH /api/copy-trading/settings/:followId` - Update settings (protected)
- `GET /api/copy-trading/my-follows` - Get my follows (protected)
- `GET /api/copy-trading/stats` - Get my copy trading stats (protected)

### Statistics
- `GET /api/stats/platform` - Platform-wide statistics
- `GET /api/stats/markets` - Market statistics
- `GET /api/stats/sources` - Per-source statistics

## Response Format

All API responses follow this standardized format:

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

## Query Parameters

### Pagination
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)

### Market Filters
- `status`: Market status (ACTIVE, RESOLVED, CANCELLED, PAUSED)
- `category`: Market category
- `source`: Market source (POLYMARKET, KALSHI, AUGUR, THALES, OMEN)
- `tags`: Comma-separated tags
- `search`: Search in title and description
- `sortBy`: Sort field (volume, liquidity, endDate, createdAt, participantCount)
- `sortOrder`: Sort direction (asc, desc)

### Trader Filters
- `source`: Trader source
- `allowCopyTrading`: Filter by copy trading availability
- `isPublic`: Filter by public visibility
- `search`: Search in username and display name
- `sortBy`: Sort field (totalPnl, totalVolume, winRate, totalTrades, currentRank)
- `sortOrder`: Sort direction (asc, desc)

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

- General endpoints: 100 requests per 15 minutes
- Authentication endpoints: 5 attempts per 15 minutes
- Copy trading endpoints: 3 attempts per minute

## Caching

The API implements Redis caching with different TTLs:
- Markets: 30 seconds
- Leaderboards: 5 minutes
- Traders: 5 minutes
- Stats: 10 minutes

## Environment Variables

```env
# Server
PORT=3001
HOST=localhost
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/octamarkets

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_FILE=
```

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis
- Bun (recommended) or npm

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start
```

### Database Setup

Make sure the database is set up and migrations are applied:

```bash
# From the backend root
bun run db:migrate:dev
bun run db:seed
```

## Architecture

The server follows a layered architecture:

- **Routes**: Define API endpoints and middleware
- **Controllers**: Handle HTTP requests and responses
- **Services**: Business logic and data processing
- **Middleware**: Authentication, validation, caching, error handling
- **Utils**: Shared utilities (logger, Redis, response helpers)

## Error Handling

The API includes comprehensive error handling:
- Validation errors (422)
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)
- Rate limit errors (429)
- Server errors (500)

## Security

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Input validation with Zod
- JWT token authentication
- Password hashing with bcrypt

## Monitoring

- Winston logging with structured logs
- Request logging with Morgan
- Health check endpoint at `/health`
- Graceful shutdown handling

## Future Enhancements

- Web3 wallet integration
- Real-time WebSocket updates
- Advanced analytics
- Machine learning recommendations
- Multi-language support