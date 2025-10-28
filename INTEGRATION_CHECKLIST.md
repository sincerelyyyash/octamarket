# Integration Checklist for Execution Engine

This checklist covers the steps needed to integrate the execution engine with the rest of the opinion markets platform.

## ✅ Completed

- [x] Execution engine implementation (`/backend/apps/execution-engine`)
- [x] Signer service implementation (`/backend/apps/signer-service`)
- [x] Kalshi RSA authentication
- [x] Polymarket EIP-712 authentication
- [x] Order placement on both venues
- [x] Order status polling and fill detection
- [x] Retry logic with DLQ
- [x] Idempotency handling
- [x] Redis Streams consumer
- [x] Quote aggregation and best-price routing
- [x] Risk controls (per-trade limits)
- [x] State reporting hooks
- [x] Documentation (README, QUICK_START, VERIFICATION)

## 📋 Server Integration Tasks

### 1. Add Internal API Endpoints

**File**: `/backend/apps/server/src/routes/internal.ts` (create new)

```typescript
import express from 'express';
import { updateTradeState } from '../controllers/internalController.js';
import { internalAuth } from '../middleware/auth.js'; // Optional: internal token auth

const router = express.Router();

// Update trade execution state
router.post('/trades/:intentId/state', internalAuth, updateTradeState);

export default router;
```

**File**: `/backend/apps/server/src/controllers/internalController.ts` (create new)

```typescript
import { Request, Response } from 'express';
import { prisma } from '@opinion-markets/database';

export const updateTradeState = async (req: Request, res: Response) => {
  try {
    const { intentId } = req.params;
    const { state, venue, orderId, avgPrice, fills, error } = req.body;

    // Update UserTrade record
    await prisma.userTrade.updateMany({
      where: { id: intentId },
      data: {
        status: state === 'FILLED' ? 'COMPLETED' : state === 'FAILED' ? 'FAILED' : 'PENDING',
        executedAt: state === 'FILLED' ? new Date() : undefined,
        sourceTradeId: orderId,
        errorMessage: error,
      },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
```

**File**: `/backend/apps/server/index.ts` (update)

```typescript
import internalRoutes from './src/routes/internal.js';

// Add to setupRoutes method:
this.app.use('/internal', internalRoutes);
```

### 2. Update Market Model

**File**: `/backend/packages/database/prisma/schema.prisma`

Add `sourceMarkets` relation to Market model:

```prisma
model Market {
  // ... existing fields ...
  
  sourceMarkets SourceMarket[]
  
  // ... rest of model ...
}

model SourceMarket {
  id              String        @id @default(cuid())
  marketId        String
  source          MarketSource
  sourceMarketId  String        // Kalshi ticker or Polymarket condition ID
  
  market          Market        @relation(fields: [marketId], references: [id], onDelete: Cascade)
  
  @@unique([marketId, source])
  @@index([source, sourceMarketId])
}
```

Run migration:
```bash
cd backend/packages/database
bunx prisma migrate dev --name add_source_markets
```

### 3. Update Market Controller

**File**: `/backend/apps/server/src/controllers/marketController.ts`

Update `getMarket` to include sourceMarkets:

```typescript
export const getMarket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        sourceMarkets: true, // Add this
      },
    });

    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    res.json({ success: true, data: market });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
```

### 4. Create Trade Submission Endpoint

**File**: `/backend/apps/server/src/routes/trades.ts` (create or update)

```typescript
import express from 'express';
import { createTrade } from '../controllers/tradeController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, createTrade);

export default router;
```

**File**: `/backend/apps/server/src/controllers/tradeController.ts` (create or update)

```typescript
import { Request, Response } from 'express';
import { prisma } from '@opinion-markets/database';
import { redis } from '../utils/redis.js';
import { v4 as uuidv4 } from 'uuid';

export const createTrade = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id; // From auth middleware
    const { marketId, side, quantity, outcomeIndex, constraints } = req.body;

    // Validate market exists
    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    // Create trade record
    const intentId = uuidv4();
    const idempotencyKey = `${userId}-${marketId}-${Date.now()}-${Math.random()}`;

    const trade = await prisma.userTrade.create({
      data: {
        id: intentId,
        userId,
        marketId,
        side,
        quantity,
        outcomeIndex,
        status: 'PENDING',
        // ... other fields
      },
    });

    // Submit to Redis stream
    await redis.xadd(
      'trades.intents',
      '*',
      'intentId', intentId,
      'userId', userId,
      'marketId', marketId,
      'side', side,
      'quantity', String(quantity),
      'outcomeIndex', String(outcomeIndex || 0),
      'constraints', JSON.stringify(constraints || {}),
      'idempotencyKey', idempotencyKey,
      'createdAt', new Date().toISOString()
    );

    res.json({ success: true, data: { tradeId: intentId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
```

## 📋 Database Tasks

### 1. Add UserTrade Model

Already designed in schema (see Server Integration #2), needs to be added to:

**File**: `/backend/packages/database/prisma/schema.prisma`

```prisma
model UserTrade {
  id                String        @id @default(cuid())
  userId            String
  marketId          String
  source            MarketSource
  
  side              TradeSide
  outcomeIndex      Int?
  quantity          Decimal       @db.Decimal(20, 8)
  price             Decimal?      @db.Decimal(10, 8)
  
  status            TradeStatus   @default(PENDING)
  executedAt        DateTime?
  sourceTradeId     String?
  
  errorMessage      String?
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  market            Market        @relation(fields: [marketId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([marketId])
  @@index([status])
}

enum TradeStatus {
  PENDING
  COMPLETED
  FAILED
  CANCELLED
}

enum TradeSide {
  BUY
  SELL
}
```

### 2. Populate Source Markets

Create a seed script or migration to map existing markets to their source markets:

**File**: `/backend/packages/database/prisma/seed-source-markets.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mappings = [
  {
    canonicalId: 'market-1',
    sources: [
      { source: 'KALSHI', sourceMarketId: 'TICKER-123' },
      { source: 'POLYMARKET', sourceMarketId: '0x123...' },
    ],
  },
  // Add more mappings...
];

async function main() {
  for (const mapping of mappings) {
    for (const source of mapping.sources) {
      await prisma.sourceMarket.upsert({
        where: {
          marketId_source: {
            marketId: mapping.canonicalId,
            source: source.source as any,
          },
        },
        create: {
          marketId: mapping.canonicalId,
          source: source.source as any,
          sourceMarketId: source.sourceMarketId,
        },
        update: {
          sourceMarketId: source.sourceMarketId,
        },
      });
    }
  }
}

main();
```

## 📋 Infrastructure Tasks

### 1. Set Up Redis

Install and configure Redis:

```bash
# macOS
brew install redis
brew services start redis

# Or use Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Or use managed service (production)
# - AWS ElastiCache
# - Redis Cloud
# - Upstash
```

### 2. Configure Credentials

**Kalshi**:
1. Sign up at https://kalshi.com
2. Go to Account Settings → API Keys
3. Generate new API key (download RSA private key)
4. Save to signer service `.env`

**Polymarket**:
1. Create EVM wallet (or use existing)
2. Fund with USDC on Polygon
3. Save private key to signer service `.env`
4. Whitelist address on Polymarket CLOB (may require KYC)

### 3. Deploy Services

**Development**:
```bash
# Terminal 1
cd backend/apps/signer-service
bun run dev

# Terminal 2
cd backend/apps/execution-engine
bun run dev

# Terminal 3
cd backend/apps/server
bun run dev
```

**Production** (example with PM2):
```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start backend/apps/signer-service/src/index.ts --name signer --interpreter bun
pm2 start backend/apps/execution-engine/src/index.ts --name engine --interpreter bun
pm2 start backend/apps/server/index.ts --name server --interpreter bun

# Save and auto-restart
pm2 save
pm2 startup
```

## 📋 Copy Trading Integration

### 1. Wire Indexer to Execution Engine

**File**: `/backend/apps/indexer/src/core/indexerService.ts`

Update `handleCopyTrading` method:

```typescript
import { createClient } from 'redis'; // or use existing Redis client

private async handleCopyTrading(trade: TradeData): Promise<void> {
  const copyTraders = await this.db.getCopyTradersForLeader(trade.traderId);
  
  for (const copyTrader of copyTraders) {
    const intentId = uuidv4();
    const idempotencyKey = `copy-${trade.id}-${copyTrader.userId}`;
    
    await this.redis.xadd(
      'trades.intents',
      '*',
      'intentId', intentId,
      'userId', copyTrader.userId,
      'marketId', trade.marketId, // Assuming canonical ID
      'side', trade.side,
      'quantity', String(copyTrader.sizeMultiplier * trade.size),
      'copyOfTradeId', trade.id,
      'idempotencyKey', idempotencyKey,
      'createdAt', new Date().toISOString()
    );
    
    this.logger.info('Submitted copy trade intent', {
      leaderId: trade.traderId,
      followerId: copyTrader.userId,
      intentId,
    });
  }
}
```

### 2. Add Treasury Account Management

Create treasury user in database for system trades:

```typescript
const treasuryUser = await prisma.user.create({
  data: {
    id: 'system-treasury',
    email: 'treasury@internal',
    // ... other required fields
  },
});
```

## 📋 Testing Tasks

### 1. Unit Tests

Create tests for core logic:
- Quote aggregation
- Best venue selection
- Risk checks
- Order plan builder

### 2. Integration Tests

Test full flow:
```bash
# Submit test intent
redis-cli XADD trades.intents * \
  intentId "test-001" \
  userId "user-123" \
  marketId "market-456" \
  side "BUY" \
  quantity "1" \
  idempotencyKey "test-key-001" \
  createdAt "2025-10-28T10:00:00Z"

# Monitor execution
tail -f logs/execution-engine.log

# Check DLQ for errors
redis-cli XREAD STREAMS trades.dlq 0
```

### 3. Sandbox Testing

- Test with Kalshi demo environment
- Test Polymarket on testnet (if available)
- Verify small orders execute correctly

## 📋 Monitoring & Operations

### 1. Add Monitoring

- Set up Prometheus metrics export
- Create Grafana dashboards
- Monitor:
  - Redis stream lag
  - Order success/failure rates
  - Average fill time
  - Venue API latency
  - DLQ size

### 2. Set Up Alerting

Alert on:
- DLQ items accumulating
- High failure rate
- Venue API errors
- Signer service down
- Redis connection lost

### 3. Operational Runbooks

Create runbooks for:
- Replaying DLQ items
- Emergency stop (pause consumer)
- Rotating API credentials
- Scaling consumer instances

## 🎯 Next Steps Priority

1. **Immediate (Required for MVP)**:
   - [ ] Add SourceMarket model to database
   - [ ] Implement `/internal/trades/:intentId/state` endpoint
   - [ ] Update market controller to return sourceMarkets
   - [ ] Create trade submission endpoint
   - [ ] Populate source market mappings

2. **Short Term (Week 1)**:
   - [ ] Set up production Redis
   - [ ] Configure Kalshi credentials
   - [ ] Configure Polymarket credentials
   - [ ] Deploy signer service
   - [ ] Deploy execution engine
   - [ ] Test end-to-end with real orders (small size)

3. **Medium Term (Week 2-3)**:
   - [ ] Wire copy trading to execution engine
   - [ ] Add monitoring and alerting
   - [ ] Create operational runbooks
   - [ ] Load test with higher volume

4. **Long Term (Month 1-2)**:
   - [ ] Replace signer service with KMS/HSM
   - [ ] Add circuit breakers
   - [ ] Implement venue balance reconciliation
   - [ ] Add WebSocket for faster fills
   - [ ] Optimize for latency

## ✅ Success Criteria

- [ ] User can submit trade from mobile/web app
- [ ] Trade is routed to best-price venue
- [ ] Order is placed with proper authentication
- [ ] Fill is detected and reported back
- [ ] User sees trade completion in app
- [ ] Copy trades execute automatically when leader trades
- [ ] Failed trades are retried or moved to DLQ
- [ ] All components run without errors for 24h

---

**Current Status**: Execution engine complete. Ready for server integration and testing.

