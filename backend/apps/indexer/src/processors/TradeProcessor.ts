import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { NormalizedTrade } from '../normalizers/types.js';
import { Prisma, TradeStatus } from '@repo/database';

/**
 * Process and store trade data
 */
export class TradeProcessor {
  /**
   * Process a single trade
   */
  async processTrade(trade: NormalizedTrade): Promise<string | null> {
    try {
      // Check if trade already exists
      const existing = await db.trade.findUnique({
        where: {
          source_sourceTradeId: {
            source: trade.source,
            sourceTradeId: trade.sourceTradeId,
          },
        },
      });

      if (existing) {
        logger.debug('Trade already exists, skipping', { sourceTradeId: trade.sourceTradeId });
        return existing.id;
      }

      // Find the canonical market
      const sourceMarket = await db.sourceMarket.findUnique({
        where: {
          source_sourceMarketId: {
            source: trade.source,
            sourceMarketId: trade.sourceMarketId,
          },
        },
      });

      // Find or create trader
      let traderId: string | undefined;
      if (trade.traderWallet || trade.traderId) {
        traderId = await this.getOrCreateTrader(
          trade.source,
          trade.traderId || trade.traderWallet!,
          trade.traderWallet
        );
      }

      // Create trade record
      const tradeRecord = await db.trade.create({
        data: {
          traderId,
          source: trade.source,
          sourceTradeId: trade.sourceTradeId,
          marketId: sourceMarket?.marketId,
          sourceMarketId: trade.sourceMarketId,
          side: trade.side,
          outcomeIndex: trade.outcomeIndex,
          quantity: trade.quantity.toString(),
          price: trade.price.toString(),
          totalValue: trade.totalValue.toString(),
          status: TradeStatus.EXECUTED,
          executedAt: trade.executedAt,
          sourceData: trade.sourceData as Prisma.JsonValue,
        },
      });

      logger.debug('Created trade record', { tradeId: tradeRecord.id });
      return tradeRecord.id;
    } catch (error) {
      logger.error('Error processing trade', { trade: trade.sourceTradeId, error });
      return null;
    }
  }

  /**
   * Get or create trader
   */
  private async getOrCreateTrader(
    source: NormalizedTrade['source'],
    sourceTraderId: string,
    wallet?: string
  ): Promise<string> {
    const existing = await db.trader.findUnique({
      where: {
        source_sourceTraderId: {
          source,
          sourceTraderId,
        },
      },
    });

    if (existing) {
      return existing.id;
    }

    const trader = await db.trader.create({
      data: {
        source,
        sourceTraderId,
        username: wallet || sourceTraderId,
      },
    });

    return trader.id;
  }

  /**
   * Process multiple trades in batch
   */
  async processTrades(trades: NormalizedTrade[]): Promise<number> {
    let successCount = 0;

    for (const trade of trades) {
      const result = await this.processTrade(trade);
      if (result) {
        successCount++;
      }
    }

    logger.info(`Processed ${successCount}/${trades.length} trades`);
    return successCount;
  }
}

