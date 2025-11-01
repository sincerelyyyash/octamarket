import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { NormalizedPrice } from '../normalizers/types.js';
import { Prisma } from '@repo/database';

/**
 * Process and store price history data
 */
export class PriceProcessor {
  /**
   * Process a single price entry
   */
  async processPrice(price: NormalizedPrice): Promise<string | null> {
    try {
      // Find the canonical market by source market ID
      const sourceMarket = await db.sourceMarket.findUnique({
        where: {
          source_sourceMarketId: {
            source: price.source,
            sourceMarketId: price.marketId,
          },
        },
      });

      if (!sourceMarket) {
        logger.warn('Source market not found for price', {
          source: price.source,
          sourceMarketId: price.marketId,
        });
        return null;
      }

      // Find outcome ID if outcome index is provided
      let outcomeId: string | undefined;
      if (price.outcomeIndex !== undefined) {
        const outcome = await db.marketOutcome.findUnique({
          where: {
            marketId_index: {
              marketId: sourceMarket.marketId,
              index: price.outcomeIndex,
            },
          },
        });
        outcomeId = outcome?.id;
      }

      // Create price history entry
      const priceHistory = await db.priceHistory.create({
        data: {
          marketId: sourceMarket.marketId,
          outcomeId,
          source: price.source,
          price: price.price.toString(),
          volume: price.volume?.toString(),
          liquidity: price.liquidity?.toString(),
          timestamp: price.timestamp,
        },
      });

      logger.debug('Created price history entry', {
        marketId: sourceMarket.marketId,
        price: price.price,
      });

      return priceHistory.id;
    } catch (error) {
      logger.error('Error processing price', { price, error });
      return null;
    }
  }

  /**
   * Process multiple prices in batch
   */
  async processPrices(prices: NormalizedPrice[]): Promise<number> {
    let successCount = 0;

    for (const price of prices) {
      const result = await this.processPrice(price);
      if (result) {
        successCount++;
      }
    }

    logger.info(`Processed ${successCount}/${prices.length} prices`);
    return successCount;
  }

  /**
   * Batch insert prices for better performance
   */
  async batchProcessPrices(prices: NormalizedPrice[]): Promise<number> {
    try {
      // Group prices by market
      const pricesByMarket = new Map<string, NormalizedPrice[]>();
      for (const price of prices) {
        const key = `${price.source}:${price.marketId}`;
        if (!pricesByMarket.has(key)) {
          pricesByMarket.set(key, []);
        }
        pricesByMarket.get(key)!.push(price);
      }

      let successCount = 0;

      // Process each market's prices
      for (const [key, marketPrices] of pricesByMarket.entries()) {
        try {
          const [source, sourceMarketId] = key.split(':');
          
          // Find the canonical market
          const sourceMarket = await db.sourceMarket.findUnique({
            where: {
              source_sourceMarketId: {
                source: source as any,
                sourceMarketId,
              },
            },
          });

          if (!sourceMarket) {
            continue;
          }

          // Create price entries
          const priceData = marketPrices.map((price) => ({
            marketId: sourceMarket.marketId,
            source: price.source,
            price: price.price.toString(),
            volume: price.volume?.toString(),
            liquidity: price.liquidity?.toString(),
            timestamp: price.timestamp,
          }));

          await db.priceHistory.createMany({
            data: priceData,
            skipDuplicates: true,
          });

          successCount += marketPrices.length;
        } catch (error) {
          logger.error('Error batch processing prices for market', { key, error });
        }
      }

      logger.info(`Batch processed ${successCount}/${prices.length} prices`);
      return successCount;
    } catch (error) {
      logger.error('Error in batch price processing', { error });
      return 0;
    }
  }
}

