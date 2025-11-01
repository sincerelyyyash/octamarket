import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { NormalizedMarket } from '../normalizers/types.js';
import { Prisma } from '@repo/database';

/**
 * Process and store market data
 */
export class MarketProcessor {
  /**
   * Process a single normalized market
   */
  async processMarket(normalizedMarket: NormalizedMarket): Promise<string | null> {
    try {
      const result = await db.$transaction(async (tx) => {
        // First, check if we have a canonical market for this source market
        const existingSourceMarket = await tx.sourceMarket.findUnique({
          where: {
            source_sourceMarketId: {
              source: normalizedMarket.source,
              sourceMarketId: normalizedMarket.sourceMarketId,
            },
          },
          include: {
            market: true,
          },
        });

        let marketId: string;

        if (existingSourceMarket) {
          // Update existing market
          marketId = existingSourceMarket.marketId;

          await tx.market.update({
            where: { id: marketId },
            data: {
              title: normalizedMarket.title,
              description: normalizedMarket.description,
              category: normalizedMarket.category,
              tags: normalizedMarket.tags || [],
              endDate: normalizedMarket.endDate,
              status: normalizedMarket.status,
              totalVolume: normalizedMarket.totalVolume?.toString(),
              totalLiquidity: normalizedMarket.totalLiquidity?.toString(),
              updatedAt: new Date(),
            },
          });

          // Update source market
          await tx.sourceMarket.update({
            where: { id: existingSourceMarket.id },
            data: {
              tokenId: normalizedMarket.tokenId,
              clobTokenIds: normalizedMarket.clobTokenIds || [],
              volumeTier: normalizedMarket.volumeTier,
              lastPriceUpdate: new Date(),
              sourceData: normalizedMarket.sourceData as Prisma.JsonValue,
              updatedAt: new Date(),
            },
          });

          logger.debug('Updated existing market', { marketId, source: normalizedMarket.source });
        } else {
          // Create new canonical market
          const newMarket = await tx.market.create({
            data: {
              title: normalizedMarket.title,
              description: normalizedMarket.description,
              category: normalizedMarket.category,
              tags: normalizedMarket.tags || [],
              endDate: normalizedMarket.endDate,
              status: normalizedMarket.status,
              totalVolume: normalizedMarket.totalVolume?.toString(),
              totalLiquidity: normalizedMarket.totalLiquidity?.toString(),
            },
          });

          marketId = newMarket.id;

          // Create source market
          await tx.sourceMarket.create({
            data: {
              marketId,
              source: normalizedMarket.source,
              sourceMarketId: normalizedMarket.sourceMarketId,
              tokenId: normalizedMarket.tokenId,
              clobTokenIds: normalizedMarket.clobTokenIds || [],
              volumeTier: normalizedMarket.volumeTier,
              lastPriceUpdate: new Date(),
              sourceData: normalizedMarket.sourceData as Prisma.JsonValue,
              isActive: true,
            },
          });

          logger.info('Created new market', { marketId, source: normalizedMarket.source, sourceMarketId: normalizedMarket.sourceMarketId });
        }

        // Process outcomes
        await this.processOutcomes(tx, marketId, normalizedMarket.outcomes);

        return marketId;
      });

      return result;
    } catch (error) {
      logger.error('Error processing market', {
        source: normalizedMarket.source,
        sourceMarketId: normalizedMarket.sourceMarketId,
        error,
      });
      return null;
    }
  }

  /**
   * Process market outcomes
   */
  private async processOutcomes(
    tx: Prisma.TransactionClient,
    marketId: string,
    outcomes: NormalizedMarket['outcomes']
  ): Promise<void> {
    for (const outcome of outcomes) {
      // Check if outcome exists
      const existing = await tx.marketOutcome.findUnique({
        where: {
          marketId_index: {
            marketId,
            index: outcome.index,
          },
        },
      });

      if (existing) {
        // Update existing outcome
        await tx.marketOutcome.update({
          where: { id: existing.id },
          data: {
            title: outcome.title,
            description: outcome.description,
            currentPrice: outcome.currentPrice?.toString(),
            currentVolume: outcome.currentVolume?.toString(),
            currentLiquidity: outcome.currentLiquidity?.toString(),
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new outcome
        await tx.marketOutcome.create({
          data: {
            marketId,
            title: outcome.title,
            description: outcome.description,
            index: outcome.index,
            currentPrice: outcome.currentPrice?.toString(),
            currentVolume: outcome.currentVolume?.toString(),
            currentLiquidity: outcome.currentLiquidity?.toString(),
          },
        });
      }
    }
  }

  /**
   * Process multiple markets in batch
   */
  async processMarkets(markets: NormalizedMarket[]): Promise<number> {
    let successCount = 0;

    for (const market of markets) {
      const result = await this.processMarket(market);
      if (result) {
        successCount++;
      }
    }

    logger.info(`Processed ${successCount}/${markets.length} markets`);
    return successCount;
  }
}

