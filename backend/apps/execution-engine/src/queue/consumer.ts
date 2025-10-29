import type { Logger } from 'winston';
import type { RedisClient } from '../lib/redis.js';
import type { EngineConfig } from '../lib/config.js';
import { resolveSourceMarkets } from '../core/market-map.js';
import { fetchVenueQuotes, chooseBestVenue } from '../core/quotes.js';
import { buildOrderPlan } from '../core/router.js';
import { preTradeRiskCheck } from '../core/risk.js';
import { reportState } from '../persistence/reporter.js';
import { intentSchema, type TradeIntent } from '../core/validator.js';
import { OrderExecutor } from '../core/executor.js';
import { SignerClient } from '../signer/client.js';
import { PolymarketAdapter } from '../venues/polymarket/adapter.js';

type StartConsumerArgs = { logger: Logger; redis: RedisClient; config: EngineConfig };

const STREAM_BLOCK_MS = 5000;
const MAX_RETRIES = 3;

export const startConsumer = async ({ logger, redis, config }: StartConsumerArgs) => {
  const { intentsStream, consumerGroup, consumerName, dlqStream } = config.redis;
  const executor = new OrderExecutor(logger, config);

  // Create group if not exists
  try {
    await redis.xgroup('CREATE', intentsStream, consumerGroup, '0', 'MKSTREAM');
    logger.info('Created consumer group', { stream: intentsStream, group: consumerGroup });
  } catch (e: any) {
    if (!String(e?.message || '').includes('BUSYGROUP')) {
      logger.warn('xgroup create failed (likely exists)', { error: e?.message });
    }
  }

  // Main loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const resp: any = await redis.call(
        'XREADGROUP',
        'GROUP',
        consumerGroup,
        consumerName,
        'BLOCK',
        STREAM_BLOCK_MS,
        'COUNT',
        '10',
        'STREAMS',
        intentsStream,
        '>'
      );

      if (!resp) continue;

      for (const [, entries] of resp as any[]) {
        for (const [id, kvs] of entries as any[]) {
          const data = parseKv(kvs);
          logger.info('Received intent', { id, intentId: data.intentId, userId: data.userId });

          // Validate intent
          let intent: TradeIntent;
          try {
            intent = intentSchema.parse({
              ...data,
              quantity: Number(data.quantity),
              outcomeIndex: data.outcomeIndex ? Number(data.outcomeIndex) : undefined,
              sourceAllowlist: data.sourceAllowlist ? JSON.parse(data.sourceAllowlist) : undefined,
              constraints: data.constraints ? JSON.parse(data.constraints) : undefined,
              clientMeta: data.clientMeta ? JSON.parse(data.clientMeta) : undefined,
            });
          } catch (err: any) {
            logger.error('Invalid intent schema', { id, error: err.message });
            await moveToDLQ(redis, dlqStream, id, data, 'INVALID_SCHEMA');
            await redis.xack(intentsStream, consumerGroup, id);
            continue;
          }

          // Check idempotency
          const processed = await redis.get(`intent:${intent.idempotencyKey}`);
          if (processed) {
            logger.info('Intent already processed (idempotency)', { intentId: intent.intentId, key: intent.idempotencyKey });
            await redis.xack(intentsStream, consumerGroup, id);
            continue;
          }

          // Process with retry
          const success = await processIntent(logger, redis, config, executor, intent, data);

          if (success) {
            await redis.setex(`intent:${intent.idempotencyKey}`, 86400 * 7, '1'); // 7 day TTL
            await redis.xack(intentsStream, consumerGroup, id);
          } else {
            const retryCount = Number(data.retryCount || '0');
            if (retryCount >= MAX_RETRIES) {
              logger.warn('Max retries exceeded, moving to DLQ', { intentId: intent.intentId });
              await moveToDLQ(redis, dlqStream, id, data, 'MAX_RETRIES');
              await redis.xack(intentsStream, consumerGroup, id);
            } else {
              // Requeue with incremented retry count
              await redis.xadd(
                intentsStream,
                '*',
                ...Object.entries({ ...data, retryCount: String(retryCount + 1) }).flat()
              );
              await redis.xack(intentsStream, consumerGroup, id);
            }
          }
        }
      }
    } catch (err: any) {
      logger.error('Consumer loop error', { error: err?.message, stack: err?.stack });
      await delay(1000);
    }
  }
};

async function processIntent(
  logger: Logger,
  redis: RedisClient,
  config: EngineConfig,
  executor: OrderExecutor,
  intent: TradeIntent,
  rawData: Record<string, string>
): Promise<boolean> {
  try {
    // 1) Resolve source markets
    const mappings = await resolveSourceMarkets(config, intent.marketId);
    const kalshi = mappings.find((m) => m.source === 'KALSHI')?.sourceMarketId;
    const polyMapping = mappings.find((m) => m.source === 'POLYMARKET');
    let polyTokenId = polyMapping?.tokenId || polyMapping?.sourceMarketId;

    // If no tokenId is stored, try to resolve from condition_id (fallback)
    if (polyTokenId && !polyMapping?.tokenId && !/^\d+$/.test(polyTokenId)) {
      try {
        const signer = new SignerClient(config);
        const creds = await signer.getPolymarketCredentials();
        const polyAdapter = new PolymarketAdapter(creds.clobEndpoint, creds.privateKey, creds.chainId);
        polyTokenId = await polyAdapter.resolveTokenId(polyTokenId, intent.outcomeIndex ?? 0);
        logger.info('Resolved Polymarket token_id from condition_id', { 
          conditionId: polyMapping?.sourceMarketId, 
          tokenId: polyTokenId 
        });
      } catch (e: any) {
        logger.warn('Failed to resolve Polymarket token_id', { error: e?.message, conditionId: polyTokenId });
      }
    }

    if (!kalshi && !polyTokenId) {
      await reportState(config, intent.intentId, 'FAILED', { reason: 'NO_SOURCE_MARKETS' });
      return true; // Don't retry
    }

    // Filter by allowlist
    const allowedKalshi = !intent.sourceAllowlist || intent.sourceAllowlist.includes('KALSHI');
    const allowedPoly = !intent.sourceAllowlist || intent.sourceAllowlist.includes('POLYMARKET');

    // 2) Quotes
    const quotes = await fetchVenueQuotes(config, logger, {
      kalshiTicker: allowedKalshi ? kalshi : undefined,
      polymarketConditionId: allowedPoly ? polyTokenId : undefined,
      outcomeIndex: intent.outcomeIndex,
    });

    const best = chooseBestVenue(quotes, intent.side);

    // 3) Build plan & risk
    const plan = buildOrderPlan(best, intent.side, intent.constraints);
    if (!plan) {
      await reportState(config, intent.intentId, 'FAILED', { reason: 'NO_BEST_VENUE' });
      return true; // Don't retry
    }

    const risk = preTradeRiskCheck(intent.quantity, plan.price, { perTradeLimit: 1_000_000 });
    if (!risk.ok) {
      await reportState(config, intent.intentId, 'FAILED', { reason: risk.reason });
      return true; // Don't retry
    }

    // 4) Execute on selected venue
    let result;
    if (plan.venue === 'KALSHI') {
      result = await executor.executeOnKalshi(intent, kalshi!, plan.price);
    } else {
      result = await executor.executeOnPolymarket(intent, polyTokenId!, plan.price);
    }

    return result.success;
  } catch (err: any) {
    logger.error('Intent processing error', { intentId: intent.intentId, error: err.message, stack: err.stack });
    return false; // Retry
  }
}

async function moveToDLQ(
  redis: RedisClient,
  dlqStream: string,
  originalId: string,
  data: Record<string, string>,
  reason: string
) {
  await redis.xadd(
    dlqStream,
    '*',
    ...Object.entries({ ...data, dlqReason: reason, originalId, dlqTimestamp: new Date().toISOString() }).flat()
  );
}

function parseKv(kvs: any[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < kvs.length; i += 2) {
    obj[String(kvs[i])] = String(kvs[i + 1]);
  }
  return obj;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}


