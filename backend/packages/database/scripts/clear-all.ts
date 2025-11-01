#!/usr/bin/env tsx
/**
 * Complete database and Redis cache cleanup script
 * WARNING: This will DELETE ALL DATA from the database and Redis cache!
 */

import { prisma } from '../src/client.js';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Redis clients for both indexer and server
const indexerRedis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  enableReadyCheck: true,
});

const serverRedis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : 0,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});

async function clearDatabase(): Promise<void> {
  console.log('🗑️  Starting database cleanup...');

  try {
    // Delete in order respecting foreign key constraints
    // Delete child tables first
    
    console.log('  Deleting PriceHistory...');
    await prisma.priceHistory.deleteMany({}).catch(() => {});
    
    console.log('  Deleting MarketEvent...');
    await prisma.marketEvent.deleteMany({}).catch(() => {});
    
    console.log('  Deleting MarketOutcome...');
    await prisma.marketOutcome.deleteMany({}).catch(() => {});
    
    console.log('  Deleting SourceMarket...');
    await prisma.sourceMarket.deleteMany({}).catch(() => {});
    
    console.log('  Deleting Trade...');
    await prisma.trade.deleteMany({}).catch(() => {});
    
    console.log('  Deleting TraderFollow...');
    await prisma.traderFollow.deleteMany({}).catch(() => {});
    
    console.log('  Deleting LeaderboardSnapshot...');
    await prisma.leaderboardSnapshot.deleteMany({}).catch(() => {});
    
    // Delete OnChain models if they exist
    try {
      console.log('  Deleting OnChainPosition...');
      await (prisma as any).onChainPosition?.deleteMany({});
    } catch (error) {
      console.log('    ! OnChainPosition table not found or already empty');
    }
    
    try {
      console.log('  Deleting OnChainCopyIntent...');
      await (prisma as any).onChainCopyIntent?.deleteMany({});
    } catch (error) {
      console.log('    ! OnChainCopyIntent table not found or already empty');
    }
    
    try {
      console.log('  Deleting OnChainCopyPolicy...');
      await (prisma as any).onChainCopyPolicy?.deleteMany({});
    } catch (error) {
      console.log('    ! OnChainCopyPolicy table not found or already empty');
    }
    
    console.log('  Deleting LedgerEntry...');
    await prisma.ledgerEntry.deleteMany({}).catch(() => {});
    
    console.log('  Deleting Transfer...');
    await prisma.transfer.deleteMany({}).catch(() => {});
    
    console.log('  Deleting Account...');
    await prisma.account.deleteMany({}).catch(() => {});
    
    console.log('  Deleting Wallet...');
    await prisma.wallet.deleteMany({}).catch(() => {});
    
    console.log('  Deleting TradeIntent...');
    await prisma.tradeIntent.deleteMany({}).catch(() => {});
    
    console.log('  Deleting MarketMapping...');
    await prisma.marketMapping.deleteMany({}).catch(() => {});
    
    console.log('  Deleting IndexerState...');
    await prisma.indexerState.deleteMany({}).catch(() => {});
    
    // Now delete parent tables
    console.log('  Deleting Market...');
    await prisma.market.deleteMany({}).catch(() => {});
    
    console.log('  Deleting Trader...');
    await prisma.trader.deleteMany({}).catch(() => {});
    
    console.log('  Deleting User...');
    await prisma.user.deleteMany({}).catch(() => {});
    
    console.log('✅ Database cleanup completed!');
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  }
}

async function clearRedis(): Promise<void> {
  console.log('🗑️  Starting Redis cleanup...');

  try {
    // Clear indexer Redis
    console.log('  Clearing indexer Redis...');
    
    // Delete trade intents stream
    try {
      await indexerRedis.del('trades.intents');
      console.log('    ✓ Deleted trades.intents stream');
    } catch (error) {
      console.log('    ! trades.intents stream not found or already deleted');
    }
    
    // Delete all copy intent idempotency keys
    const idempotencyKeys = await indexerRedis.keys('copy:intent:idemp:*');
    if (idempotencyKeys.length > 0) {
      await indexerRedis.del(...idempotencyKeys);
      console.log(`    ✓ Deleted ${idempotencyKeys.length} idempotency keys`);
    }
    
    // Clear all keys in indexer Redis DB
    try {
      await indexerRedis.flushdb();
      console.log('    ✓ Flushed indexer Redis database');
    } catch (error) {
      console.log('    ! Could not flush indexer Redis:', error instanceof Error ? error.message : String(error));
    }
    
    // Clear server Redis
    console.log('  Clearing server Redis...');
    
    // Delete all cache keys with common patterns
    const cachePatterns = [
      'cache:*',
      'market:*',
      'leaderboard:*',
      'trader:*',
      'stats:*',
      'auth:*',
    ];
    
    let totalDeleted = 0;
    for (const pattern of cachePatterns) {
      const keys = await serverRedis.keys(pattern);
      if (keys.length > 0) {
        const deleted = await serverRedis.del(...keys);
        totalDeleted += deleted;
        console.log(`    ✓ Deleted ${deleted} keys matching ${pattern}`);
      }
    }
    
    // Also try to flush the entire DB if patterns didn't catch everything
    try {
      const allKeys = await serverRedis.keys('*');
      if (allKeys.length > 0) {
        await serverRedis.del(...allKeys);
        console.log(`    ✓ Deleted ${allKeys.length} remaining keys`);
      }
      
      // Final flush
      await serverRedis.flushdb();
      console.log('    ✓ Flushed server Redis database');
    } catch (error) {
      console.log('    ! Could not flush server Redis:', error instanceof Error ? error.message : String(error));
    }
    
    console.log('✅ Redis cleanup completed!');
  } catch (error) {
    console.error('❌ Redis cleanup failed:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('⚠️  WARNING: This will DELETE ALL DATA from the database and Redis!');
  console.log('');
  
  // Check if running in non-interactive mode (skip confirmation)
  if (process.env.FORCE_CLEAR !== 'true') {
    console.log('To proceed, run with FORCE_CLEAR=true environment variable');
    console.log('Example: FORCE_CLEAR=true bun run scripts/clear-all.ts');
    process.exit(1);
  }
  
  console.log('Starting complete cleanup...\n');
  
  try {
    // Clear database first
    await clearDatabase();
    console.log('');
    
    // Then clear Redis
    await clearRedis();
    console.log('');
    
    console.log('🎉 Complete cleanup finished successfully!');
  } catch (error) {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  } finally {
    // Disconnect all connections
    await prisma.$disconnect();
    await indexerRedis.quit();
    await serverRedis.quit();
  }
}

main();

