import { prisma } from '@repo/database';
import { Prisma } from '@repo/database';
import { MarketSource, MarketStatus, EventType } from '@repo/database';
import { TradeSide, TradeStatus } from '../types/index.js';
import type { 
  MarketData, 
  MarketEventData, 
  PriceData, 
  NormalizedMarket, 
  DeduplicationResult,
  TraderData,
  TradeData,
  NormalizedTrader,
  NormalizedTrade,
  LeaderboardData,
  TraderFollowData
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class DatabaseManager {
  private readonly logger = logger.child({ component: 'databaseManager' });

  /**
   * Store or update a market in the database
   */
  async storeMarket(normalizedMarket: NormalizedMarket): Promise<string> {
    try {
      const { sourceMarketId, source, marketData } = normalizedMarket;

      // Check if source market already exists
      const existingSourceMarket = await prisma.sourceMarket.findUnique({
        where: {
          source_sourceMarketId: {
            source,
            sourceMarketId,
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
        await this.updateMarket(marketId, marketData);
        
        // Update source market data
        await prisma.sourceMarket.update({
          where: { id: existingSourceMarket.id },
          data: {
            sourceData: marketData as any,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new market
        const market = await prisma.market.create({
          data: {
            title: marketData.title,
            description: marketData.description,
            category: marketData.category,
            tags: marketData.tags || [],
            endDate: marketData.endDate,
            resolutionDate: marketData.resolutionDate,
            status: marketData.status,
            totalVolume: marketData.totalVolume ? new Prisma.Decimal(marketData.totalVolume) : null,
            totalLiquidity: marketData.totalLiquidity ? new Prisma.Decimal(marketData.totalLiquidity) : null,
            participantCount: marketData.participantCount,
            resolvedOutcome: marketData.resolvedOutcome,
            resolutionSource: marketData.resolutionSource,
          },
        });

        marketId = market.id;

        // Create source market link (check if it already exists)
        const existingSourceMarket = await prisma.sourceMarket.findUnique({
          where: {
            source_sourceMarketId: {
              source,
              sourceMarketId,
            },
          },
        });

        if (!existingSourceMarket) {
          await prisma.sourceMarket.create({
            data: {
              marketId,
              source,
              sourceMarketId,
              sourceData: marketData as any,
            },
          });
        } else {
          // Update existing source market with new data
          await prisma.sourceMarket.update({
            where: {
              source_sourceMarketId: {
                source,
                sourceMarketId,
              },
            },
            data: {
              marketId,
              sourceData: marketData as any,
              updatedAt: new Date(),
            },
          });
        }

        // Create market outcomes
        if (marketData.outcomes?.length) {
          await prisma.marketOutcome.createMany({
            data: marketData.outcomes.map(outcome => ({
              marketId,
              title: outcome.title,
              description: outcome.description,
              index: outcome.index,
              currentPrice: outcome.currentPrice ? new Prisma.Decimal(outcome.currentPrice) : null,
              currentVolume: outcome.currentVolume ? new Prisma.Decimal(outcome.currentVolume) : null,
              currentLiquidity: outcome.currentLiquidity ? new Prisma.Decimal(outcome.currentLiquidity) : null,
              isWinning: outcome.isWinning,
            })),
          });
        }
      }

      this.logger.debug('Stored market', {
        marketId,
        source,
        sourceMarketId,
        title: marketData.title,
      });

      return marketId;
    } catch (error) {
      this.logger.error('Failed to store market', {
        source: normalizedMarket.source,
        sourceMarketId: normalizedMarket.sourceMarketId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store a market event
   */
  async storeMarketEvent(event: MarketEventData): Promise<void> {
    try {
      // Find the market by source market ID
      const sourceMarket = await this.findSourceMarket(event.source, event.marketId);
      if (!sourceMarket) {
        this.logger.warn('Market not found for event', {
          source: event.source,
          sourceMarketId: event.marketId,
        });
        return;
      }

      await prisma.marketEvent.create({
        data: {
          marketId: sourceMarket.marketId,
          source: event.source,
          eventType: event.eventType,
          timestamp: event.timestamp,
          data: event.data as any,
          rawPayload: event.rawPayload as any,
        },
      });

      this.logger.debug('Stored market event', {
        marketId: sourceMarket.marketId,
        source: event.source,
        eventType: event.eventType,
      });
    } catch (error) {
      this.logger.error('Failed to store market event', {
        source: event.source,
        marketId: event.marketId,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Store price data
   */
  async storePriceData(priceData: PriceData): Promise<void> {
    try {
      // Find the market by source market ID
      const sourceMarket = await this.findSourceMarket(priceData.source, priceData.marketId);
      if (!sourceMarket) {
        this.logger.warn('Market not found for price data', {
          source: priceData.source,
          sourceMarketId: priceData.marketId,
        });
        return;
      }

      // Find outcome if specified
      let outcomeId: string | null = null;
      if (priceData.outcomeId) {
        const outcome = await prisma.marketOutcome.findFirst({
          where: {
            marketId: sourceMarket.marketId,
            index: parseInt(priceData.outcomeId),
          },
        });
        outcomeId = outcome?.id || null;
      }

      await prisma.priceHistory.create({
        data: {
          marketId: sourceMarket.marketId,
          outcomeId,
          source: priceData.source,
          price: new Prisma.Decimal(priceData.price),
          volume: priceData.volume ? new Prisma.Decimal(priceData.volume) : null,
          liquidity: priceData.liquidity ? new Prisma.Decimal(priceData.liquidity) : null,
          timestamp: priceData.timestamp,
        },
      });

      // Update current price in market outcome
      if (outcomeId) {
        await prisma.marketOutcome.update({
          where: { id: outcomeId },
          data: {
            currentPrice: new Prisma.Decimal(priceData.price),
            currentVolume: priceData.volume ? new Prisma.Decimal(priceData.volume) : undefined,
            currentLiquidity: priceData.liquidity ? new Prisma.Decimal(priceData.liquidity) : undefined,
          },
        });
      }

      this.logger.debug('Stored price data', {
        marketId: sourceMarket.marketId,
        source: priceData.source,
        price: priceData.price,
      });
    } catch (error) {
      this.logger.error('Failed to store price data', {
        source: priceData.source,
        marketId: priceData.marketId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Store market deduplication mapping
   */
  async storeMarketMapping(mapping: DeduplicationResult): Promise<void> {
    try {
      for (const duplicateMarketId of mapping.duplicateMarkets) {
        await prisma.marketMapping.upsert({
          where: {
            canonicalMarketId_duplicateMarketId: {
              canonicalMarketId: mapping.canonicalMarketId,
              duplicateMarketId,
            },
          },
          update: {
            confidence: new Prisma.Decimal(mapping.confidence),
          },
          create: {
            canonicalMarketId: mapping.canonicalMarketId,
            duplicateMarketId,
            confidence: new Prisma.Decimal(mapping.confidence),
          },
        });
      }

      this.logger.info('Stored market mapping', {
        canonicalMarketId: mapping.canonicalMarketId,
        duplicateCount: mapping.duplicateMarkets.length,
        confidence: mapping.confidence,
      });
    } catch (error) {
      this.logger.error('Failed to store market mapping', {
        canonicalMarketId: mapping.canonicalMarketId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update indexer state
   */
  async updateIndexerState(
    source: MarketSource,
    lastSyncAt?: Date,
    lastBlockNumber?: bigint,
    lastEventId?: string,
    error?: string
  ): Promise<void> {
    try {
      await prisma.indexerState.upsert({
        where: { source },
        update: {
          lastSyncAt,
          lastBlockNumber,
          lastEventId,
          lastError: error || null,
          errorCount: error ? { increment: 1 } : { set: 0 },
          updatedAt: new Date(),
        },
        create: {
          source,
          lastSyncAt,
          lastBlockNumber,
          lastEventId,
          lastError: error || null,
          errorCount: error ? 1 : 0,
        },
      });
    } catch (error) {
      this.logger.error('Failed to update indexer state', {
        source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get existing markets for deduplication
   */
  async getExistingMarkets(limit = 1000): Promise<MarketData[]> {
    try {
      const markets = await prisma.market.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          outcomes: true,
        },
      });

      return markets.map(market => ({
        id: market.id,
        title: market.title,
        description: market.description || undefined,
        category: market.category || undefined,
        tags: Array.isArray(market.tags) ? market.tags as string[] : [],
        endDate: market.endDate || undefined,
        resolutionDate: market.resolutionDate || undefined,
        status: market.status,
        totalVolume: market.totalVolume ? parseFloat(market.totalVolume.toString()) : undefined,
        totalLiquidity: market.totalLiquidity ? parseFloat(market.totalLiquidity.toString()) : undefined,
        participantCount: market.participantCount || undefined,
        resolvedOutcome: market.resolvedOutcome || undefined,
        resolutionSource: market.resolutionSource || undefined,
        outcomes: market.outcomes.map(outcome => ({
          title: outcome.title,
          description: outcome.description || undefined,
          index: outcome.index,
          currentPrice: outcome.currentPrice ? parseFloat(outcome.currentPrice.toString()) : undefined,
          currentVolume: outcome.currentVolume ? parseFloat(outcome.currentVolume.toString()) : undefined,
          currentLiquidity: outcome.currentLiquidity ? parseFloat(outcome.currentLiquidity.toString()) : undefined,
          isWinning: outcome.isWinning || undefined,
        })),
      }));
    } catch (error) {
      this.logger.error('Failed to get existing markets', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async updateMarket(marketId: string, marketData: MarketData): Promise<void> {
    await prisma.market.update({
      where: { id: marketId },
      data: {
        title: marketData.title,
        description: marketData.description,
        category: marketData.category,
        tags: marketData.tags || [],
        endDate: marketData.endDate,
        resolutionDate: marketData.resolutionDate,
        status: marketData.status,
        totalVolume: marketData.totalVolume ? new Prisma.Decimal(marketData.totalVolume) : null,
        totalLiquidity: marketData.totalLiquidity ? new Prisma.Decimal(marketData.totalLiquidity) : null,
        participantCount: marketData.participantCount,
        resolvedOutcome: marketData.resolvedOutcome,
        resolutionSource: marketData.resolutionSource,
        updatedAt: new Date(),
      },
    });

    // Update outcomes
    if (marketData.outcomes?.length) {
      for (const outcome of marketData.outcomes) {
        await prisma.marketOutcome.upsert({
          where: {
            marketId_index: {
              marketId,
              index: outcome.index,
            },
          },
          update: {
            title: outcome.title,
            description: outcome.description,
            currentPrice: outcome.currentPrice ? new Prisma.Decimal(outcome.currentPrice) : null,
            currentVolume: outcome.currentVolume ? new Prisma.Decimal(outcome.currentVolume) : null,
            currentLiquidity: outcome.currentLiquidity ? new Prisma.Decimal(outcome.currentLiquidity) : null,
            isWinning: outcome.isWinning,
            updatedAt: new Date(),
          },
          create: {
            marketId,
            title: outcome.title,
            description: outcome.description,
            index: outcome.index,
            currentPrice: outcome.currentPrice ? new Prisma.Decimal(outcome.currentPrice) : null,
            currentVolume: outcome.currentVolume ? new Prisma.Decimal(outcome.currentVolume) : null,
            currentLiquidity: outcome.currentLiquidity ? new Prisma.Decimal(outcome.currentLiquidity) : null,
            isWinning: outcome.isWinning,
          },
        });
      }
    }
  }

  private async findSourceMarket(source: MarketSource, sourceMarketId: string) {
    return prisma.sourceMarket.findUnique({
      where: {
        source_sourceMarketId: {
          source,
          sourceMarketId,
        },
      },
    });
  }

  // Leaderboard and Trader methods

  /**
   * Store or update a trader in the database
   */
  async storeTrader(normalizedTrader: NormalizedTrader): Promise<string> {
    try {
      const { sourceTraderId, source, traderData } = normalizedTrader;

      // Check if trader already exists
      const existingTrader = await prisma.trader.findUnique({
        where: {
          source_sourceTraderId: {
            source,
            sourceTraderId,
          },
        },
      });

      let traderId: string;

      if (existingTrader) {
        // Update existing trader
        traderId = existingTrader.id;
        await this.updateTrader(traderId, traderData);
      } else {
        // Create new trader
        const trader = await prisma.trader.create({
          data: {
            source,
            sourceTraderId,
            username: traderData.username,
            displayName: traderData.displayName,
            profileImageUrl: traderData.profileImageUrl,
            totalTrades: traderData.totalTrades,
            totalVolume: new Prisma.Decimal(traderData.totalVolume),
            totalPnl: new Prisma.Decimal(traderData.totalPnl),
            winRate: traderData.winRate ? new Prisma.Decimal(traderData.winRate) : null,
            avgReturn: traderData.avgReturn ? new Prisma.Decimal(traderData.avgReturn) : null,
            currentRank: traderData.currentRank,
            bestRank: traderData.bestRank,
            rankChange: traderData.rankChange || 0,
            lastActiveAt: traderData.lastActiveAt,
            firstTradeAt: traderData.firstTradeAt,
            lastTradeAt: traderData.lastTradeAt,
            isPublic: traderData.isPublic,
            allowCopyTrading: traderData.allowCopyTrading,
            maxFollowers: traderData.maxFollowers,
            sourceData: traderData.sourceData as any,
          },
        });

        traderId = trader.id;
      }

      this.logger.debug('Stored trader', {
        traderId,
        source,
        sourceTraderId,
        username: traderData.username,
      });

      return traderId;
    } catch (error) {
      this.logger.error('Failed to store trader', {
        source: normalizedTrader.source,
        sourceTraderId: normalizedTrader.sourceTraderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store or update a trade in the database
   */
  async storeTrade(normalizedTrade: NormalizedTrade): Promise<string> {
    try {
      const { sourceTradeId, source, tradeData } = normalizedTrade;

      // Check if trade already exists
      const existingTrade = await prisma.trade.findUnique({
        where: {
          source_sourceTradeId: {
            source,
            sourceTradeId,
          },
        },
      });

      let tradeId: string;

      if (existingTrade) {
        // Update existing trade
        tradeId = existingTrade.id;
        await this.updateTrade(tradeId, tradeData);
      } else {
        // Find the trader by source trader ID
        const trader = await prisma.trader.findFirst({
          where: {
            source,
            sourceTraderId: tradeData.traderId,
          },
        });

        if (!trader) {
          this.logger.warn('Trader not found for trade', {
            source,
            sourceTraderId: tradeData.traderId,
            sourceTradeId,
          });
          return '';
        }

        // Find the market if it exists
        let marketId: string | null = null;
        if (tradeData.marketId) {
          marketId = tradeData.marketId;
        } else {
          // Try to find market by source market ID
          const sourceMarket = await prisma.sourceMarket.findFirst({
            where: {
              source,
              sourceMarketId: tradeData.sourceMarketId,
            },
          });
          marketId = sourceMarket?.marketId || null;
        }

        // Safely validate the executedAt date
        let executedAt: Date;
        if (tradeData.executedAt && !isNaN(tradeData.executedAt.getTime())) {
          executedAt = tradeData.executedAt;
        } else {
          executedAt = new Date();
          this.logger.warn('Invalid executedAt date, using current date', {
            sourceTradeId,
            originalExecutedAt: tradeData.executedAt,
          });
        }

        // Create new trade
        const trade = await prisma.trade.create({
          data: {
            traderId: trader.id,
            source,
            sourceTradeId,
            marketId,
            sourceMarketId: tradeData.sourceMarketId,
            side: tradeData.side,
            outcomeIndex: tradeData.outcomeIndex,
            quantity: new Prisma.Decimal(tradeData.quantity),
            price: new Prisma.Decimal(tradeData.price),
            totalValue: new Prisma.Decimal(tradeData.totalValue),
            status: tradeData.status,
            executedAt,
            realizedPnl: tradeData.realizedPnl ? new Prisma.Decimal(tradeData.realizedPnl) : null,
            unrealizedPnl: tradeData.unrealizedPnl ? new Prisma.Decimal(tradeData.unrealizedPnl) : null,
            isCopyTrade: tradeData.isCopyTrade,
            originalTradeId: tradeData.originalTradeId,
            copiedByTraderId: tradeData.copiedByTraderId,
            sourceData: tradeData.sourceData as any,
          },
        });

        tradeId = trade.id;
      }

      this.logger.debug('Stored trade', {
        tradeId,
        source,
        sourceTradeId,
        traderId: tradeData.traderId,
      });

      return tradeId;
    } catch (error) {
      this.logger.error('Failed to store trade', {
        source: normalizedTrade.source,
        sourceTradeId: normalizedTrade.sourceTradeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store leaderboard snapshot
   */
  async storeLeaderboardSnapshot(leaderboard: LeaderboardData): Promise<void> {
    try {
      if (leaderboard.traders.length === 0) return;

      const topTrader = leaderboard.traders[0];
      if (!topTrader) {
        this.logger.warn('No top trader found in leaderboard', {
          source: leaderboard.source,
          traderCount: leaderboard.traders.length,
        });
        return;
      }

      const topTraderRecord = await prisma.trader.findFirst({
        where: {
          source: leaderboard.source,
          sourceTraderId: topTrader.sourceTraderId,
        },
      });

      if (!topTraderRecord) {
        this.logger.warn('Top trader not found for leaderboard snapshot', {
          source: leaderboard.source,
          topTraderId: topTrader.sourceTraderId,
        });
        return;
      }

      await prisma.leaderboardSnapshot.create({
        data: {
          source: leaderboard.source,
          snapshotDate: leaderboard.snapshotDate,
          topTraderId: topTraderRecord.id,
          topTraderPnl: new Prisma.Decimal(topTrader.totalPnl),
          topTraderVolume: new Prisma.Decimal(topTrader.totalVolume),
          totalTraders: leaderboard.totalTraders,
          totalVolume: new Prisma.Decimal(leaderboard.totalVolume),
          totalTrades: leaderboard.totalTrades,
          avgPnl: new Prisma.Decimal(leaderboard.avgPnl),
        },
      });

      this.logger.info('Stored leaderboard snapshot', {
        source: leaderboard.source,
        totalTraders: leaderboard.totalTraders,
        topTraderPnl: topTrader.totalPnl,
      });
    } catch (error) {
      this.logger.error('Failed to store leaderboard snapshot', {
        source: leaderboard.source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Store trader follow relationship
   */
  async storeTraderFollow(followData: TraderFollowData): Promise<string> {
    try {
      const follow = await prisma.traderFollow.upsert({
        where: {
          followerId_followingId: {
            followerId: followData.followerId,
            followingId: followData.followingId,
          },
        },
        update: {
          autoCopyTrades: followData.autoCopyTrades,
          maxCopyAmount: followData.maxCopyAmount ? new Prisma.Decimal(followData.maxCopyAmount) : null,
          copyPercentage: followData.copyPercentage ? new Prisma.Decimal(followData.copyPercentage) : null,
          totalCopiedTrades: followData.totalCopiedTrades,
          totalCopiedValue: new Prisma.Decimal(followData.totalCopiedValue),
          totalCopiedPnl: new Prisma.Decimal(followData.totalCopiedPnl),
          updatedAt: new Date(),
        },
        create: {
          followerId: followData.followerId,
          followingId: followData.followingId,
          autoCopyTrades: followData.autoCopyTrades,
          maxCopyAmount: followData.maxCopyAmount ? new Prisma.Decimal(followData.maxCopyAmount) : null,
          copyPercentage: followData.copyPercentage ? new Prisma.Decimal(followData.copyPercentage) : null,
          totalCopiedTrades: followData.totalCopiedTrades,
          totalCopiedValue: new Prisma.Decimal(followData.totalCopiedValue),
          totalCopiedPnl: new Prisma.Decimal(followData.totalCopiedPnl),
        },
      });

      this.logger.debug('Stored trader follow', {
        followId: follow.id,
        followerId: followData.followerId,
        followingId: followData.followingId,
      });

      return follow.id;
    } catch (error) {
      this.logger.error('Failed to store trader follow', {
        followerId: followData.followerId,
        followingId: followData.followingId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get traders for copy trading
   */
  async getTradersForCopyTrading(source?: MarketSource): Promise<TraderData[]> {
    try {
      const where: any = {
        allowCopyTrading: true,
        isPublic: true,
      };

      if (source) {
        where.source = source;
      }

      const traders = await prisma.trader.findMany({
        where,
        orderBy: [
          { totalPnl: 'desc' },
          { totalVolume: 'desc' },
        ],
        take: config.leaderboard.maxTradersPerSource,
      });

      return traders.map(trader => ({
        id: trader.id,
        source: trader.source,
        sourceTraderId: trader.sourceTraderId,
        username: trader.username || undefined,
        displayName: trader.displayName || undefined,
        profileImageUrl: trader.profileImageUrl || undefined,
        totalTrades: trader.totalTrades,
        totalVolume: parseFloat(trader.totalVolume.toString()),
        totalPnl: parseFloat(trader.totalPnl.toString()),
        winRate: trader.winRate ? parseFloat(trader.winRate.toString()) : undefined,
        avgReturn: trader.avgReturn ? parseFloat(trader.avgReturn.toString()) : undefined,
        currentRank: trader.currentRank || undefined,
        bestRank: trader.bestRank || undefined,
        rankChange: trader.rankChange || undefined,
        lastActiveAt: trader.lastActiveAt || undefined,
        firstTradeAt: trader.firstTradeAt || undefined,
        lastTradeAt: trader.lastTradeAt || undefined,
        isPublic: trader.isPublic,
        allowCopyTrading: trader.allowCopyTrading,
        maxFollowers: trader.maxFollowers || undefined,
        sourceData: trader.sourceData as Record<string, any> || undefined,
      }));
    } catch (error) {
      this.logger.error('Failed to get traders for copy trading', {
        source,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get followers of a trader
   */
  async getTraderFollowers(traderId: string): Promise<TraderFollowData[]> {
    try {
      const follows = await prisma.traderFollow.findMany({
        where: {
          followingId: traderId,
          autoCopyTrades: true,
        },
        include: {
          follower: true,
        },
      });

      return follows.map(follow => ({
        followerId: follow.followerId,
        followingId: follow.followingId,
        autoCopyTrades: follow.autoCopyTrades,
        maxCopyAmount: follow.maxCopyAmount ? parseFloat(follow.maxCopyAmount.toString()) : undefined,
        copyPercentage: follow.copyPercentage ? parseFloat(follow.copyPercentage.toString()) : undefined,
        totalCopiedTrades: follow.totalCopiedTrades,
        totalCopiedValue: parseFloat(follow.totalCopiedValue.toString()),
        totalCopiedPnl: parseFloat(follow.totalCopiedPnl.toString()),
      }));
    } catch (error) {
      this.logger.error('Failed to get trader followers', {
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Update indexer state with trade sync timestamp
   */
  async updateIndexerTradeSync(source: MarketSource, lastTradeSyncAt?: Date): Promise<void> {
    try {
      await prisma.indexerState.upsert({
        where: { source },
        update: {
          lastTradeSyncAt,
          updatedAt: new Date(),
        },
        create: {
          source,
          lastTradeSyncAt,
        },
      });
    } catch (error) {
      this.logger.error('Failed to update indexer trade sync state', {
        source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async updateTrader(traderId: string, traderData: TraderData): Promise<void> {
    await prisma.trader.update({
      where: { id: traderId },
      data: {
        username: traderData.username,
        displayName: traderData.displayName,
        profileImageUrl: traderData.profileImageUrl,
        totalTrades: traderData.totalTrades,
        totalVolume: new Prisma.Decimal(traderData.totalVolume),
        totalPnl: new Prisma.Decimal(traderData.totalPnl),
        winRate: traderData.winRate ? new Prisma.Decimal(traderData.winRate) : null,
        avgReturn: traderData.avgReturn ? new Prisma.Decimal(traderData.avgReturn) : null,
        currentRank: traderData.currentRank,
        bestRank: traderData.bestRank,
        rankChange: traderData.rankChange || 0,
        lastActiveAt: traderData.lastActiveAt,
        firstTradeAt: traderData.firstTradeAt,
        lastTradeAt: traderData.lastTradeAt,
        isPublic: traderData.isPublic,
        allowCopyTrading: traderData.allowCopyTrading,
        maxFollowers: traderData.maxFollowers,
        sourceData: traderData.sourceData as any,
        updatedAt: new Date(),
      },
    });
  }

  private async updateTrade(tradeId: string, tradeData: TradeData): Promise<void> {
    // Find the trader by source trader ID
    const trader = await prisma.trader.findFirst({
      where: {
        source: tradeData.source,
        sourceTraderId: tradeData.traderId,
      },
    });

    if (!trader) {
      this.logger.warn('Trader not found for trade update', {
        source: tradeData.source,
        sourceTraderId: tradeData.traderId,
        tradeId,
      });
      return;
    }

    // Safely validate the executedAt date
    let executedAt: Date;
    if (tradeData.executedAt && !isNaN(tradeData.executedAt.getTime())) {
      executedAt = tradeData.executedAt;
    } else {
      executedAt = new Date();
      this.logger.warn('Invalid executedAt date, using current date', {
        tradeId,
        originalExecutedAt: tradeData.executedAt,
      });
    }

    await prisma.trade.update({
      where: { id: tradeId },
      data: {
        traderId: trader.id,
        side: tradeData.side,
        outcomeIndex: tradeData.outcomeIndex,
        quantity: new Prisma.Decimal(tradeData.quantity),
        price: new Prisma.Decimal(tradeData.price),
        totalValue: new Prisma.Decimal(tradeData.totalValue),
        status: tradeData.status,
        executedAt,
        realizedPnl: tradeData.realizedPnl ? new Prisma.Decimal(tradeData.realizedPnl) : null,
        unrealizedPnl: tradeData.unrealizedPnl ? new Prisma.Decimal(tradeData.unrealizedPnl) : null,
        isCopyTrade: tradeData.isCopyTrade,
        originalTradeId: tradeData.originalTradeId,
        copiedByTraderId: tradeData.copiedByTraderId,
        sourceData: tradeData.sourceData as any,
        updatedAt: new Date(),
      },
    });
  }

  // Batch write methods for queue system

  /**
   * Store multiple market events in batch
   */
  async storeMarketEventsBatch(events: MarketEventData[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const marketEvents = [];
      
      for (const event of events) {
        // Find the market by source market ID
        const sourceMarket = await this.findSourceMarket(event.source, event.marketId);
        if (!sourceMarket) {
          this.logger.warn('Market not found for event', {
            source: event.source,
            sourceMarketId: event.marketId,
          });
          continue;
        }

        marketEvents.push({
          marketId: sourceMarket.marketId,
          source: event.source,
          eventType: event.eventType,
          timestamp: event.timestamp,
          data: event.data as any,
          rawPayload: event.rawPayload as any,
        });
      }

      if (marketEvents.length > 0) {
        await prisma.marketEvent.createMany({
          data: marketEvents,
          skipDuplicates: true,
        });

        this.logger.debug('Stored market events batch', {
          count: marketEvents.length,
          requested: events.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to store market events batch', {
        count: events.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store multiple price data entries in batch
   */
  async storePriceDataBatch(priceDataList: PriceData[]): Promise<void> {
    if (priceDataList.length === 0) return;

    try {
      const priceEntries = [];
      
      for (const priceData of priceDataList) {
        // Find the market by source market ID
        const sourceMarket = await this.findSourceMarket(priceData.source, priceData.marketId);
        if (!sourceMarket) {
          this.logger.warn('Market not found for price data', {
            source: priceData.source,
            sourceMarketId: priceData.marketId,
          });
          continue;
        }

        // Find outcome if specified
        let outcomeId: string | null = null;
        if (priceData.outcomeId) {
          const outcome = await prisma.marketOutcome.findFirst({
            where: {
              marketId: sourceMarket.marketId,
              index: parseInt(priceData.outcomeId),
            },
          });
          outcomeId = outcome?.id || null;
        }

        priceEntries.push({
          marketId: sourceMarket.marketId,
          outcomeId,
          source: priceData.source,
          price: new Prisma.Decimal(priceData.price),
          volume: priceData.volume ? new Prisma.Decimal(priceData.volume) : null,
          liquidity: priceData.liquidity ? new Prisma.Decimal(priceData.liquidity) : null,
          timestamp: priceData.timestamp,
        });
      }

      if (priceEntries.length > 0) {
        await prisma.priceHistory.createMany({
          data: priceEntries,
          skipDuplicates: true,
        });

        this.logger.debug('Stored price data batch', {
          count: priceEntries.length,
          requested: priceDataList.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to store price data batch', {
        count: priceDataList.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store multiple trades in batch
   */
  async storeTradesBatch(trades: TradeData[]): Promise<void> {
    if (trades.length === 0) return;

    try {
      const tradeEntries = [];
      
      for (const tradeData of trades) {
        // Find the trader by source trader ID
        const trader = await prisma.trader.findFirst({
          where: {
            source: tradeData.source,
            sourceTraderId: tradeData.traderId,
          },
        });

        if (!trader) {
          this.logger.warn('Trader not found for trade', {
            source: tradeData.source,
            sourceTraderId: tradeData.traderId,
            sourceTradeId: tradeData.sourceTradeId,
          });
          continue;
        }

        // Find the market if it exists
        let marketId: string | null = null;
        if (tradeData.marketId) {
          marketId = tradeData.marketId;
        } else {
          const sourceMarket = await prisma.sourceMarket.findFirst({
            where: {
              source: tradeData.source,
              sourceMarketId: tradeData.sourceMarketId,
            },
          });
          marketId = sourceMarket?.marketId || null;
        }

        // Safely validate the executedAt date
        let executedAt: Date;
        if (tradeData.executedAt && !isNaN(tradeData.executedAt.getTime())) {
          executedAt = tradeData.executedAt;
        } else {
          executedAt = new Date();
        }

        tradeEntries.push({
          traderId: trader.id,
          source: tradeData.source,
          sourceTradeId: tradeData.sourceTradeId,
          marketId,
          sourceMarketId: tradeData.sourceMarketId,
          side: tradeData.side,
          outcomeIndex: tradeData.outcomeIndex,
          quantity: new Prisma.Decimal(tradeData.quantity),
          price: new Prisma.Decimal(tradeData.price),
          totalValue: new Prisma.Decimal(tradeData.totalValue),
          status: tradeData.status,
          executedAt,
          realizedPnl: tradeData.realizedPnl ? new Prisma.Decimal(tradeData.realizedPnl) : null,
          unrealizedPnl: tradeData.unrealizedPnl ? new Prisma.Decimal(tradeData.unrealizedPnl) : null,
          isCopyTrade: tradeData.isCopyTrade,
          originalTradeId: tradeData.originalTradeId,
          copiedByTraderId: tradeData.copiedByTraderId,
          sourceData: tradeData.sourceData as any,
        });
      }

      if (tradeEntries.length > 0) {
        await prisma.trade.createMany({
          data: tradeEntries,
          skipDuplicates: true,
        });

        this.logger.debug('Stored trades batch', {
          count: tradeEntries.length,
          requested: trades.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to store trades batch', {
        count: trades.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store multiple traders in batch
   */
  async storeTradersBatch(traders: TraderData[]): Promise<void> {
    if (traders.length === 0) return;

    try {
      const traderEntries = traders.map(traderData => ({
        source: traderData.source,
        sourceTraderId: traderData.sourceTraderId,
        username: traderData.username,
        displayName: traderData.displayName,
        profileImageUrl: traderData.profileImageUrl,
        totalTrades: traderData.totalTrades,
        totalVolume: new Prisma.Decimal(traderData.totalVolume),
        totalPnl: new Prisma.Decimal(traderData.totalPnl),
        winRate: traderData.winRate ? new Prisma.Decimal(traderData.winRate) : null,
        avgReturn: traderData.avgReturn ? new Prisma.Decimal(traderData.avgReturn) : null,
        currentRank: traderData.currentRank,
        bestRank: traderData.bestRank,
        rankChange: traderData.rankChange || 0,
        lastActiveAt: traderData.lastActiveAt,
        firstTradeAt: traderData.firstTradeAt,
        lastTradeAt: traderData.lastTradeAt,
        isPublic: traderData.isPublic,
        allowCopyTrading: traderData.allowCopyTrading,
        maxFollowers: traderData.maxFollowers,
        sourceData: traderData.sourceData as any,
      }));

      await prisma.trader.createMany({
        data: traderEntries,
        skipDuplicates: true,
      });

      this.logger.debug('Stored traders batch', {
        count: traderEntries.length,
      });
    } catch (error) {
      this.logger.error('Failed to store traders batch', {
        count: traders.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store multiple leaderboard snapshots in batch
   */
  async storeLeaderboardSnapshotBatch(leaderboards: LeaderboardData[]): Promise<void> {
    if (leaderboards.length === 0) return;

    try {
      const snapshotEntries = [];
      
      for (const leaderboard of leaderboards) {
        if (leaderboard.traders.length === 0) continue;

        const topTrader = leaderboard.traders[0];
        if (!topTrader) continue;

        const topTraderRecord = await prisma.trader.findFirst({
          where: {
            source: leaderboard.source,
            sourceTraderId: topTrader.sourceTraderId,
          },
        });

        if (!topTraderRecord) {
          this.logger.warn('Top trader not found for leaderboard snapshot', {
            source: leaderboard.source,
            topTraderId: topTrader.sourceTraderId,
          });
          continue;
        }

        snapshotEntries.push({
          source: leaderboard.source,
          snapshotDate: leaderboard.snapshotDate,
          topTraderId: topTraderRecord.id,
          topTraderPnl: new Prisma.Decimal(topTrader.totalPnl),
          topTraderVolume: new Prisma.Decimal(topTrader.totalVolume),
          totalTraders: leaderboard.totalTraders,
          totalVolume: new Prisma.Decimal(leaderboard.totalVolume),
          totalTrades: leaderboard.totalTrades,
          avgPnl: new Prisma.Decimal(leaderboard.avgPnl),
        });
      }

      if (snapshotEntries.length > 0) {
        await prisma.leaderboardSnapshot.createMany({
          data: snapshotEntries,
          skipDuplicates: true,
        });

        this.logger.debug('Stored leaderboard snapshots batch', {
          count: snapshotEntries.length,
          requested: leaderboards.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to store leaderboard snapshots batch', {
        count: leaderboards.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Store multiple trader follows in batch
   */
  async storeTraderFollowsBatch(follows: TraderFollowData[]): Promise<void> {
    if (follows.length === 0) return;

    try {
      const followEntries = follows.map(followData => ({
        followerId: followData.followerId,
        followingId: followData.followingId,
        autoCopyTrades: followData.autoCopyTrades,
        maxCopyAmount: followData.maxCopyAmount ? new Prisma.Decimal(followData.maxCopyAmount) : null,
        copyPercentage: followData.copyPercentage ? new Prisma.Decimal(followData.copyPercentage) : null,
        totalCopiedTrades: followData.totalCopiedTrades,
        totalCopiedValue: new Prisma.Decimal(followData.totalCopiedValue),
        totalCopiedPnl: new Prisma.Decimal(followData.totalCopiedPnl),
      }));

      await prisma.traderFollow.createMany({
        data: followEntries,
        skipDuplicates: true,
      });

      this.logger.debug('Stored trader follows batch', {
        count: followEntries.length,
      });
    } catch (error) {
      this.logger.error('Failed to store trader follows batch', {
        count: follows.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
