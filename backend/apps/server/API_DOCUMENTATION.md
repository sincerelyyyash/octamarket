# OctaMarkets API Documentation

A comprehensive REST API server for OctaMarkets prediction market aggregator platform.

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Authentication](#authentication-endpoints)
  - [Markets](#markets-endpoints)
  - [Traders](#traders-endpoints)
  - [Leaderboard](#leaderboard-endpoints)
  - [Statistics](#statistics-endpoints)
  - [Copy Trading](#copy-trading-endpoints)
- [Data Models](#data-models)
- [Examples](#examples)

## Overview

The OctaMarkets API provides access to prediction market data from multiple sources including Polymarket, Kalshi, Augur, Thales, and Omen. The API supports real-time market data, trader analytics, leaderboards, and copy trading functionality.

## Base URL

```
http://localhost:3001
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Getting a Token

1. Register a new user: `POST /api/auth/register`
2. Login: `POST /api/auth/login`
3. Use the returned token in subsequent requests

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

### Response Fields

- `success`: Boolean indicating if the request was successful
- `data`: The actual response data
- `error`: Error information (only present when success is false)
- `meta`: Pagination metadata (only present for paginated endpoints)

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {
      "field": "validation details"
    }
  }
}
```

## Rate Limiting

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 attempts per 15 minutes
- **Copy trading endpoints**: 3 attempts per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Endpoints

### Health Check

#### GET /

Get server information and available endpoints.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "OctaMarkets API Server",
    "version": "1.0.0",
    "environment": "development",
    "endpoints": {
      "auth": "/api/auth",
      "markets": "/api/markets",
      "leaderboard": "/api/leaderboard",
      "traders": "/api/traders",
      "copyTrading": "/api/copy-trading",
      "stats": "/api/stats"
    }
  }
}
```

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-10-27T16:26:25.285Z",
    "uptime": 6.105140416999999,
    "environment": "development"
  }
}
```

### Authentication Endpoints

#### POST /api/auth/register

Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cmh9csj4b0000oukqptjfbd2g",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### POST /api/auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cmh9csj4b0000oukqptjfbd2g",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### GET /api/auth/me

Get current user profile. **Requires Authentication**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmh9csj4b0000oukqptjfbd2g",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### PATCH /api/auth/profile

Update user profile. **Requires Authentication**

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "John Smith",
  "email": "johnsmith@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmh9csj4b0000oukqptjfbd2g",
    "name": "John Smith",
    "email": "johnsmith@example.com"
  }
}
```

#### POST /api/auth/wallet/connect

Connect Web3 wallet to user account. **Requires Authentication**

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    "connectedAt": "2025-10-27T16:30:00.000Z"
  }
}
```

### Markets Endpoints

#### GET /api/markets

Get list of markets with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `status` (string): Market status (ACTIVE, RESOLVED, CANCELLED, PAUSED)
- `category` (string): Market category
- `source` (string): Market source (POLYMARKET, KALSHI, AUGUR, THALES, OMEN)
- `tags` (string): Comma-separated tags
- `search` (string): Search in title and description
- `sortBy` (string): Sort field (volume, liquidity, endDate, createdAt, participantCount)
- `sortOrder` (string): Sort direction (asc, desc)

**Example Request:**
```
GET /api/markets?page=1&limit=5&source=POLYMARKET&status=ACTIVE
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9acpcs02qrou66ya4n0okx",
      "title": "Will Bitcoin hit $100,000 by end of 2024?",
      "description": "This market resolves to Yes if Bitcoin reaches $100,000 or higher by December 31, 2024.",
      "category": "Crypto",
      "tags": ["bitcoin", "crypto", "price"],
      "createdAt": "2025-10-27T15:21:34.259Z",
      "updatedAt": "2025-10-27T15:21:34.259Z",
      "endDate": "2025-12-31T23:59:59.000Z",
      "status": "ACTIVE",
      "totalVolume": 125000.50,
      "totalLiquidity": 50000.25,
      "participantCount": 1250,
      "outcomes": [
        {
          "id": "cmh9acpfb0317ou66jekpt0ne",
          "title": "Yes",
          "index": 0,
          "currentPrice": 0.65
        },
        {
          "id": "cmh9acpfb0318ou66xgj7vapm",
          "title": "No",
          "index": 1,
          "currentPrice": 0.35
        }
      ],
      "sourceMarkets": [
        {
          "id": "cmh9acpe202wfou66sj8a1b16",
          "source": "POLYMARKET",
          "sourceMarketId": "0x123...",
          "isActive": true
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 5,
    "total": 200,
    "hasMore": true
  }
}
```

#### GET /api/markets/:id

Get specific market by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmh9acpcs02qrou66ya4n0okx",
    "title": "Will Bitcoin hit $100,000 by end of 2024?",
    "description": "This market resolves to Yes if Bitcoin reaches $100,000 or higher by December 31, 2024.",
    "category": "Crypto",
    "tags": ["bitcoin", "crypto", "price"],
    "createdAt": "2025-10-27T15:21:34.259Z",
    "updatedAt": "2025-10-27T15:21:34.259Z",
    "endDate": "2025-12-31T23:59:59.000Z",
    "status": "ACTIVE",
    "totalVolume": 125000.50,
    "totalLiquidity": 50000.25,
    "participantCount": 1250,
    "outcomes": [
      {
        "id": "cmh9acpfb0317ou66jekpt0ne",
        "title": "Yes",
        "index": 0,
        "currentPrice": 0.65,
        "currentVolume": 75000.30,
        "currentLiquidity": 30000.15
      },
      {
        "id": "cmh9acpfb0318ou66xgj7vapm",
        "title": "No",
        "index": 1,
        "currentPrice": 0.35,
        "currentVolume": 50000.20,
        "currentLiquidity": 20000.10
      }
    ],
    "sourceMarkets": [
      {
        "id": "cmh9acpe202wfou66sj8a1b16",
        "source": "POLYMARKET",
        "sourceMarketId": "0x123...",
        "isActive": true
      }
    ]
  }
}
```

#### GET /api/markets/:id/outcomes

Get market outcomes.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9acpfb0317ou66jekpt0ne",
      "title": "Yes",
      "description": "Bitcoin reaches $100,000 or higher",
      "index": 0,
      "currentPrice": 0.65,
      "currentVolume": 75000.30,
      "currentLiquidity": 30000.15,
      "isWinning": null
    },
    {
      "id": "cmh9acpfb0318ou66xgj7vapm",
      "title": "No",
      "description": "Bitcoin does not reach $100,000",
      "index": 1,
      "currentPrice": 0.35,
      "currentVolume": 50000.20,
      "currentLiquidity": 20000.10,
      "isWinning": null
    }
  ]
}
```

#### GET /api/markets/:id/price-history

Get price history for a market.

**Query Parameters:**
- `outcomeId` (string): Specific outcome ID
- `source` (string): Market source
- `startDate` (string): Start date (ISO format)
- `endDate` (string): End date (ISO format)
- `limit` (number): Number of records (default: 100, max: 1000)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9abpjr00fdou6633pxsbiy",
      "marketId": "cmh9acpcs02qrou66ya4n0okx",
      "outcomeId": "cmh9acpfb0317ou66jekpt0ne",
      "source": "POLYMARKET",
      "price": 0.65,
      "volume": 1000.50,
      "liquidity": 500.25,
      "timestamp": "2025-10-27T16:00:00.000Z"
    }
  ]
}
```

#### GET /api/markets/active

Get active markets only.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

#### GET /api/markets/trending

Get trending markets (by volume and participants).

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

#### GET /api/markets/categories

Get all available market categories.

**Response:**
```json
{
  "success": true,
  "data": [
    "Sports",
    "Crypto",
    "Olympics",
    "US-current-affairs",
    "Coronavirus",
    "NFTs",
    "Chess",
    "Poker",
    "Pop-Culture",
    "NBA Playoffs",
    "Ukraine & Russia",
    "Art",
    "Business"
  ]
}
```

#### GET /api/markets/tags

Get all available market tags.

**Response:**
```json
{
  "success": true,
  "data": [
    "bitcoin",
    "crypto",
    "price",
    "election",
    "politics",
    "sports",
    "nfl",
    "nba"
  ]
}
```

### Traders Endpoints

#### GET /api/traders

Get list of traders with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `source` (string): Trader source (POLYMARKET, KALSHI, AUGUR, THALES, OMEN)
- `allowCopyTrading` (boolean): Filter by copy trading availability
- `isPublic` (boolean): Filter by public visibility
- `search` (string): Search in username and display name
- `sortBy` (string): Sort field (totalPnl, totalVolume, winRate, totalTrades, currentRank)
- `sortOrder` (string): Sort direction (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9aau910000ou666wncvfhk",
      "source": "POLYMARKET",
      "sourceTraderId": "0x9d84ce0306f8551e02efef1680475fc0f1dc1344",
      "username": "🤺JustWakingUp",
      "displayName": "🤺JustWakingUp",
      "profileImageUrl": "https://polymarket-upload.s3.us-east-2.amazonaws.com/profile-image-82662-f2f4a9f1-d024-4ee3-8bf1-38a0ce169679.png",
      "totalTrades": 9362,
      "totalVolume": 415660423.56,
      "totalPnl": 2387479.46,
      "winRate": 0.68,
      "avgReturn": 0.12,
      "currentRank": 1,
      "bestRank": 1,
      "rankChange": 0,
      "lastActiveAt": "2025-10-27T15:19:27.000Z",
      "firstTradeAt": "2024-01-15T10:30:00.000Z",
      "lastTradeAt": "2025-10-27T15:19:27.000Z",
      "isPublic": true,
      "allowCopyTrading": false,
      "maxFollowers": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "hasMore": true
  }
}
```

#### GET /api/traders/:id

Get specific trader by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmh9aau910000ou666wncvfhk",
    "source": "POLYMARKET",
    "sourceTraderId": "0x9d84ce0306f8551e02efef1680475fc0f1dc1344",
    "username": "🤺JustWakingUp",
    "displayName": "🤺JustWakingUp",
    "profileImageUrl": "https://polymarket-upload.s3.us-east-2.amazonaws.com/profile-image-82662-f2f4a9f1-d024-4ee3-8bf1-38a0ce169679.png",
    "totalTrades": 9362,
    "totalVolume": 415660423.56,
    "totalPnl": 2387479.46,
    "winRate": 0.68,
    "avgReturn": 0.12,
    "currentRank": 1,
    "bestRank": 1,
    "rankChange": 0,
    "lastActiveAt": "2025-10-27T15:19:27.000Z",
    "firstTradeAt": "2024-01-15T10:30:00.000Z",
    "lastTradeAt": "2025-10-27T15:19:27.000Z",
    "isPublic": true,
    "allowCopyTrading": false,
    "maxFollowers": null
  }
}
```

#### GET /api/traders/:id/stats

Get detailed trader statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "trader": {
      "id": "cmh9aau910000ou666wncvfhk",
      "totalTrades": 9362,
      "totalVolume": 415660423.56,
      "totalPnl": 2387479.46,
      "winRate": 0.68,
      "avgReturn": 0.12,
      "currentRank": 1,
      "bestRank": 1,
      "rankChange": 0,
      "lastActiveAt": "2025-10-27T15:19:27.000Z",
      "firstTradeAt": "2024-01-15T10:30:00.000Z",
      "lastTradeAt": "2025-10-27T15:19:27.000Z"
    },
    "additionalStats": {
      "totalTradeValue": 2351939.56,
      "totalRealizedPnl": 2998254.39,
      "totalTradeCount": 125,
      "followerCount": 0,
      "followingCount": 0
    }
  }
}
```

#### GET /api/traders/:id/trades

Get trader's trade history.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `marketId` (string): Filter by market ID
- `source` (string): Filter by source
- `side` (string): Filter by side (BUY, SELL)
- `status` (string): Filter by status (PENDING, EXECUTED, CANCELLED, FAILED)
- `isCopyTrade` (boolean): Filter copy trades
- `startDate` (string): Start date filter
- `endDate` (string): End date filter

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9abpul00fhou6637jjmd96",
      "traderId": "cmh9aau910000ou666wncvfhk",
      "source": "POLYMARKET",
      "sourceTradeId": "92325249719485031139867422012514654102580961954747753469470405147070256604118",
      "marketId": "cmh9acpcs02qrou66ya4n0okx",
      "sourceMarketId": "0x36db77c539bcc8c7bf0686c1b99f30c5a5eed1f53d3b3a27a071550c81f83701",
      "side": "BUY",
      "outcomeIndex": 0,
      "quantity": 118631.32,
      "price": 0.009524,
      "totalValue": 1129.84,
      "status": "EXECUTED",
      "executedAt": "2025-10-27T15:20:48.269Z",
      "realizedPnl": 8.83,
      "unrealizedPnl": 471.68,
      "isCopyTrade": false,
      "originalTradeId": null,
      "copiedByTraderId": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "hasMore": true
  }
}
```

#### GET /api/traders/:id/followers

Get trader's followers.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9csj4b0000oukqptjfbd2g",
      "follower": {
        "id": "cmh9csj4b0000oukqptjfbd2g",
        "username": "john_doe",
        "displayName": "John Doe",
        "profileImageUrl": "https://example.com/avatar.jpg",
        "totalPnl": 15000.50,
        "totalVolume": 50000.25
      },
      "autoCopyTrades": true,
      "maxCopyAmount": 1000.00,
      "copyPercentage": 0.5,
      "totalCopiedTrades": 25,
      "totalCopiedValue": 25000.00,
      "totalCopiedPnl": 1250.50,
      "createdAt": "2025-10-27T16:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "hasMore": false
  }
}
```

#### GET /api/traders/:id/following

Get traders that this trader is following.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

#### GET /api/traders/copy-trading

Get traders available for copy trading.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `source` (string): Filter by source

### Leaderboard Endpoints

#### GET /api/leaderboard

Get global leaderboard.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `source` (string): Filter by source
- `sortBy` (string): Sort field (totalPnl, totalVolume, winRate, currentRank)
- `sortOrder` (string): Sort direction (asc, desc)
- `timeframe` (string): Timeframe (1h, 24h, 7d, 30d, all)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9aau910000ou666wncvfhk",
      "source": "POLYMARKET",
      "sourceTraderId": "0x9d84ce0306f8551e02efef1680475fc0f1dc1344",
      "username": "🤺JustWakingUp",
      "displayName": "🤺JustWakingUp",
      "profileImageUrl": "https://polymarket-upload.s3.us-east-2.amazonaws.com/profile-image-82662-f2f4a9f1-d024-4ee3-8bf1-38a0ce169679.png",
      "totalTrades": 9362,
      "totalVolume": 415660423.56,
      "totalPnl": 2387479.46,
      "winRate": 0.68,
      "avgReturn": 0.12,
      "currentRank": 1,
      "bestRank": 1,
      "rankChange": 0,
      "lastActiveAt": "2025-10-27T15:19:27.000Z",
      "firstTradeAt": "2024-01-15T10:30:00.000Z",
      "lastTradeAt": "2025-10-27T15:19:27.000Z",
      "isPublic": true,
      "allowCopyTrading": false,
      "maxFollowers": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "hasMore": true
  }
}
```

#### GET /api/leaderboard/:source

Get source-specific leaderboard.

**Path Parameters:**
- `source`: Market source (POLYMARKET, KALSHI, AUGUR, THALES, OMEN)

**Query Parameters:** Same as global leaderboard

#### GET /api/leaderboard/top

Get top traders by PnL and volume.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `source` (string): Filter by source
- `timeframe` (string): Timeframe filter

#### GET /api/leaderboard/rising

Get rising traders (by rank change).

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `source` (string): Filter by source
- `timeframe` (string): Timeframe filter

#### GET /api/leaderboard/snapshots

Get historical leaderboard snapshots.

**Query Parameters:**
- `source` (string): Filter by source
- `limit` (number): Number of snapshots (default: 10, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9abpjr00fdou6633pxsbiy",
      "source": "POLYMARKET",
      "snapshotDate": "2025-10-27T15:20:47.893Z",
      "topTrader": {
        "id": "cmh9aau910000ou666wncvfhk",
        "username": "🤺JustWakingUp",
        "displayName": "🤺JustWakingUp",
        "profileImageUrl": "https://polymarket-upload.s3.us-east-2.amazonaws.com/profile-image-82662-f2f4a9f1-d024-4ee3-8bf1-38a0ce169679.png",
        "source": "POLYMARKET"
      },
      "topTraderPnl": 2387479.46,
      "topTraderVolume": 415660423.56,
      "totalTraders": 50,
      "totalVolume": 8604017506.08,
      "totalTrades": 164015,
      "avgPnl": 233836.70
    }
  ]
}
```

### Statistics Endpoints

#### GET /api/stats/platform

Get platform-wide statistics.

**Query Parameters:**
- `timeframe` (string): Timeframe (1h, 24h, 7d, 30d, all)

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalMarkets": 200,
      "activeMarkets": 100,
      "resolvedMarkets": 50,
      "totalTraders": 50,
      "totalVolume": 52113606.99,
      "totalTrades": 838,
      "avgMarketVolume": 260568.03,
      "avgTraderPnl": 233836.70,
      "recentActivity": 661
    },
    "timeframe": "all",
    "generatedAt": "2025-10-27T16:29:30.876Z"
  }
}
```

#### GET /api/stats/markets

Get market statistics.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalMarkets": 200,
      "marketsByCategory": [
        {
          "category": "Sports",
          "count": 46
        },
        {
          "category": "Crypto",
          "count": 10
        }
      ],
      "marketsBySource": [
        {
          "source": "POLYMARKET",
          "count": 100
        },
        {
          "source": "KALSHI",
          "count": 100
        }
      ],
      "marketsByStatus": [
        {
          "status": "ACTIVE",
          "count": 100
        },
        {
          "status": "CANCELLED",
          "count": 100
        }
      ]
    },
    "topMarkets": {
      "byVolume": [
        {
          "id": "cmh9acpau02lwou66qrklkgh2",
          "title": "Will Bitcoin hit $100,000?",
          "category": "Crypto",
          "status": "ACTIVE",
          "totalVolume": 125000.50,
          "participantCount": 1250,
          "outcomes": [
            {
              "id": "cmh9acpej02yeou66kxy9q0jt",
              "title": "Yes",
              "currentPrice": 0.65
            }
          ]
        }
      ],
      "byParticipants": [
        {
          "id": "cmh9acpb302mtou66e3b775a8",
          "title": "Election 2024 Winner",
          "category": "US-current-affairs",
          "status": "ACTIVE",
          "totalVolume": 925000.00,
          "participantCount": 9250,
          "outcomes": [
            {
              "id": "cmh9acpel02ypou661x5iigtj",
              "title": "Candidate A",
              "currentPrice": 0.52
            }
          ]
        }
      ]
    },
    "generatedAt": "2025-10-27T16:29:37.067Z"
  }
}
```

#### GET /api/stats/sources

Get per-source statistics.

**Query Parameters:**
- `timeframe` (string): Timeframe (1h, 24h, 7d, 30d, all)

**Response:**
```json
{
  "success": true,
  "data": {
    "sources": [
      {
        "source": "POLYMARKET",
        "markets": 100,
        "traders": 50,
        "trades": 838,
        "volume": 52113606.99,
        "avgTradeValue": 62188.08
      },
      {
        "source": "KALSHI",
        "markets": 100,
        "traders": 0,
        "trades": 0,
        "volume": 0,
        "avgTradeValue": 0
      }
    ],
    "timeframe": "all",
    "generatedAt": "2025-10-27T16:29:43.862Z"
  }
}
```

#### GET /api/stats/traders

Get trader statistics.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

#### GET /api/stats/leaderboard

Get leaderboard statistics.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `source` (string): Filter by source

### Copy Trading Endpoints

All copy trading endpoints require authentication.

#### POST /api/copy-trading/follow

Follow a trader for copy trading. **Requires Authentication**

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "traderId": "cmh9aau910000ou666wncvfhk",
  "autoCopyTrades": true,
  "maxCopyAmount": 1000.00,
  "copyPercentage": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmh9csj4b0000oukqptjfbd2g",
    "followerId": "cmh9csj4b0000oukqptjfbd2g",
    "followingId": "cmh9aau910000ou666wncvfhk",
    "autoCopyTrades": true,
    "maxCopyAmount": 1000.00,
    "copyPercentage": 0.5,
    "totalCopiedTrades": 0,
    "totalCopiedValue": 0.00,
    "totalCopiedPnl": 0.00,
    "createdAt": "2025-10-27T16:30:00.000Z",
    "updatedAt": "2025-10-27T16:30:00.000Z",
    "followingTrader": {
      "id": "cmh9aau910000ou666wncvfhk",
      "source": "POLYMARKET",
      "sourceTraderId": "0x9d84ce0306f8551e02efef1680475fc0f1dc1344",
      "username": "🤺JustWakingUp",
      "displayName": "🤺JustWakingUp",
      "profileImageUrl": "https://polymarket-upload.s3.us-east-2.amazonaws.com/profile-image-82662-f2f4a9f1-d024-4ee3-8bf1-38a0ce169679.png",
      "totalTrades": 9362,
      "totalVolume": 415660423.56,
      "totalPnl": 2387479.46,
      "winRate": 0.68,
      "currentRank": 1,
      "isPublic": true,
      "allowCopyTrading": true
    }
  }
}
```

#### DELETE /api/copy-trading/unfollow/:traderId

Unfollow a trader. **Requires Authentication**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `204 No Content`

#### PATCH /api/copy-trading/settings/:followId

Update copy trading settings. **Requires Authentication**

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "autoCopyTrades": false,
  "maxCopyAmount": 2000.00,
  "copyPercentage": 0.75
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmh9csj4b0000oukqptjfbd2g",
    "followerId": "cmh9csj4b0000oukqptjfbd2g",
    "followingId": "cmh9aau910000ou666wncvfhk",
    "autoCopyTrades": false,
    "maxCopyAmount": 2000.00,
    "copyPercentage": 0.75,
    "totalCopiedTrades": 25,
    "totalCopiedValue": 25000.00,
    "totalCopiedPnl": 1250.50,
    "createdAt": "2025-10-27T16:30:00.000Z",
    "updatedAt": "2025-10-27T16:35:00.000Z",
    "followingTrader": {
      "id": "cmh9aau910000ou666wncvfhk",
      "source": "POLYMARKET",
      "sourceTraderId": "0x9d84ce0306f8551e02efef1680475fc0f1dc1344",
      "username": "🤺JustWakingUp",
      "displayName": "🤺JustWakingUp",
      "profileImageUrl": "https://polymarket-upload.s3.us-east-2.amazonaws.com/profile-image-82662-f2f4a9f1-d024-4ee3-8bf1-38a0ce169679.png",
      "totalTrades": 9362,
      "totalVolume": 415660423.56,
      "totalPnl": 2387479.46,
      "winRate": 0.68,
      "currentRank": 1,
      "isPublic": true,
      "allowCopyTrading": true
    }
  }
}
```

#### GET /api/copy-trading/my-follows

Get user's followed traders. **Requires Authentication**

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmh9csj4b0000oukqptjfbd2g",
      "followerId": "cmh9csj4b0000oukqptjfbd2g",
      "followingId": "cmh9aau910000ou666wncvfhk",
      "autoCopyTrades": true,
      "maxCopyAmount": 1000.00,
      "copyPercentage": 0.5,
      "totalCopiedTrades": 25,
      "totalCopiedValue": 25000.00,
      "totalCopiedPnl": 1250.50,
      "createdAt": "2025-10-27T16:30:00.000Z",
      "updatedAt": "2025-10-27T16:30:00.000Z",
      "followingTrader": {
        "id": "cmh9aau910000ou666wncvfhk",
        "source": "POLYMARKET",
        "sourceTraderId": "0x9d84ce0306f8551e02efef1680475fc0f1dc1344",
        "username": "🤺JustWakingUp",
        "displayName": "🤺JustWakingUp",
        "profileImageUrl": "https://polymarket-upload.s3.us-east-2.amazonaws.com/profile-image-82662-f2f4a9f1-d024-4ee3-8bf1-38a0ce169679.png",
        "totalTrades": 9362,
        "totalVolume": 415660423.56,
        "totalPnl": 2387479.46,
        "winRate": 0.68,
        "currentRank": 1,
        "isPublic": true,
        "allowCopyTrading": true
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "hasMore": false
  }
}
```

#### GET /api/copy-trading/stats

Get user's copy trading statistics. **Requires Authentication**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "followCount": 1,
      "totalCopiedTrades": 25,
      "totalCopiedValue": 25000.00,
      "totalCopiedPnl": 1250.50
    },
    "recentCopiedTrades": [
      {
        "id": "cmh9abpul00fhou6637jjmd96",
        "trader": {
          "id": "cmh9aau910000ou666wncvfhk",
          "username": "🤺JustWakingUp",
          "displayName": "🤺JustWakingUp"
        },
        "side": "BUY",
        "quantity": 500.00,
        "price": 0.65,
        "totalValue": 325.00,
        "realizedPnl": 15.50,
        "executedAt": "2025-10-27T15:20:48.269Z"
      }
    ],
    "generatedAt": "2025-10-27T16:30:00.000Z"
  }
}
```

## Data Models

### Market

```typescript
interface Market {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  endDate?: string;
  resolutionDate?: string;
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED' | 'PAUSED';
  totalVolume?: number;
  totalLiquidity?: number;
  participantCount?: number;
  resolvedOutcome?: string;
  resolutionSource?: string;
  outcomes: MarketOutcome[];
  sourceMarkets: SourceMarket[];
}
```

### MarketOutcome

```typescript
interface MarketOutcome {
  id: string;
  title: string;
  description?: string;
  index: number;
  currentPrice?: number;
  currentVolume?: number;
  currentLiquidity?: number;
  isWinning?: boolean;
}
```

### Trader

```typescript
interface Trader {
  id: string;
  source: 'POLYMARKET' | 'KALSHI' | 'AUGUR' | 'THALES' | 'OMEN';
  sourceTraderId: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
  totalTrades: number;
  totalVolume: number;
  totalPnl: number;
  winRate?: number;
  avgReturn?: number;
  currentRank?: number;
  bestRank?: number;
  rankChange?: number;
  lastActiveAt?: string;
  firstTradeAt?: string;
  lastTradeAt?: string;
  isPublic: boolean;
  allowCopyTrading: boolean;
  maxFollowers?: number;
}
```

### Trade

```typescript
interface Trade {
  id: string;
  traderId: string;
  source: 'POLYMARKET' | 'KALSHI' | 'AUGUR' | 'THALES' | 'OMEN';
  sourceTradeId: string;
  marketId?: string;
  sourceMarketId: string;
  side: 'BUY' | 'SELL';
  outcomeIndex?: number;
  quantity: number;
  price: number;
  totalValue: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
  executedAt: string;
  realizedPnl?: number;
  unrealizedPnl?: number;
  isCopyTrade: boolean;
  originalTradeId?: string;
  copiedByTraderId?: string;
}
```

### User

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Examples

### Complete Authentication Flow

```bash
# 1. Register a new user
curl -X POST "http://localhost:3001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'

# 2. Login
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "password123"}'

# 3. Use token in subsequent requests
curl "http://localhost:3001/api/auth/me" \
  -H "Authorization: Bearer <token>"
```

### Market Filtering Examples

```bash
# Get active markets from Polymarket
curl "http://localhost:3001/api/markets?status=ACTIVE&source=POLYMARKET&page=1&limit=10"

# Search for COVID-related markets
curl "http://localhost:3001/api/markets?search=COVID&page=1&limit=5"

# Get markets sorted by volume
curl "http://localhost:3001/api/markets?sortBy=volume&sortOrder=desc&page=1&limit=10"

# Get markets by category
curl "http://localhost:3001/api/markets?category=Crypto&page=1&limit=10"
```

### Trader Analytics Examples

```bash
# Get top traders by PnL
curl "http://localhost:3001/api/traders?sortBy=totalPnl&sortOrder=desc&page=1&limit=10"

# Get traders from specific source
curl "http://localhost:3001/api/traders?source=POLYMARKET&page=1&limit=10"

# Search for specific trader
curl "http://localhost:3001/api/traders?search=JustWakingUp"

# Get trader's trade history
curl "http://localhost:3001/api/traders/<trader-id>/trades?page=1&limit=20"
```

### Copy Trading Examples

```bash
# Follow a trader
curl -X POST "http://localhost:3001/api/copy-trading/follow" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"traderId": "<trader-id>", "autoCopyTrades": true, "maxCopyAmount": 1000}'

# Get my follows
curl "http://localhost:3001/api/copy-trading/my-follows" \
  -H "Authorization: Bearer <token>"

# Update copy settings
curl -X PATCH "http://localhost:3001/api/copy-trading/settings/<follow-id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"autoCopyTrades": false, "maxCopyAmount": 2000}'

# Get copy trading stats
curl "http://localhost:3001/api/copy-trading/stats" \
  -H "Authorization: Bearer <token>"
```

## Caching

The API implements Redis caching with different TTLs:
- **Markets**: 30 seconds
- **Leaderboards**: 5 minutes
- **Traders**: 5 minutes
- **Stats**: 10 minutes
- **Auth**: 1 minute

Cache headers are included in responses:
- `X-Cache`: HIT or MISS
- `X-Cache-Key`: Cache key used

## WebSocket Support

WebSocket support is planned for real-time updates:
- Market price updates
- Trade notifications
- Leaderboard changes
- Copy trading alerts

## SDKs and Libraries

Official SDKs are planned for:
- JavaScript/TypeScript
- Python
- Go
- Rust

## Support

For API support and questions:
- Email: api-support@octamarkets.com
- Documentation: https://docs.octamarkets.com
- Status Page: https://status.octamarkets.com
