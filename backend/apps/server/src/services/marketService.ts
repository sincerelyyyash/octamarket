import { prisma, Prisma } from '@repo/database';
import { MarketSource, MarketStatus } from '@repo/database';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';
import { config } from '../config/index';
import type { 
  MarketFilters, 
  MarketResponse, 
  MarketOutcomeResponse, 
  SourceMarketResponse,
  PriceHistoryResponse 
} from '../types/index.js';

export class MarketService {
  /**
   * Get per-source prices for outcomes
   */
  private async getOutcomePrices(outcomeIds: string[]): Promise<Map<string, Array<{
    source: MarketSource;
    price: number;
    volume?: number;
    liquidity?: number;
    timestamp: string;
  }>>> {
    if (outcomeIds.length === 0) {
      return new Map();
    }

    // Get latest price history entries per source per outcome
    const latestPrices = await prisma.priceHistory.findMany({
      where: {
        outcomeId: { in: outcomeIds },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Group by outcomeId, then by source (keep only latest per source)
    const pricesByOutcome = new Map<string, Map<MarketSource, typeof latestPrices[0]>>();
    for (const price of latestPrices) {
      if (!price.outcomeId) continue;
      if (!pricesByOutcome.has(price.outcomeId)) {
        pricesByOutcome.set(price.outcomeId, new Map());
      }
      const outcomePrices = pricesByOutcome.get(price.outcomeId)!;
      // Only keep latest price per source
      if (!outcomePrices.has(price.source) || 
          (outcomePrices.get(price.source)!.timestamp < price.timestamp)) {
        outcomePrices.set(price.source, price);
      }
    }

    // Convert to response format
    const result = new Map<string, Array<{
      source: MarketSource;
      price: number;
      volume?: number;
      liquidity?: number;
      timestamp: string;
    }>>();

    for (const [outcomeId, sourcePrices] of pricesByOutcome.entries()) {
      const prices = Array.from(sourcePrices.values()).map(ph => ({
        source: ph.source,
        price: parseFloat(ph.price.toString()),
        volume: ph.volume ? parseFloat(ph.volume.toString()) : undefined,
        liquidity: ph.liquidity ? parseFloat(ph.liquidity.toString()) : undefined,
        timestamp: ph.timestamp.toISOString(),
      }));
      result.set(outcomeId, prices);
    }

    return result;
  }

  /**
   * Enrich outcome with per-source prices and best price
   */
  private enrichOutcome(
    outcome: { id: string; title: string; description: string | null; index: number; currentPrice: any; currentVolume: any; currentLiquidity: any; isWinning: boolean | null },
    pricesMap: Map<string, Array<{ source: MarketSource; price: number; volume?: number; liquidity?: number; timestamp: string }>>
  ): MarketOutcomeResponse {
    const prices = pricesMap.get(outcome.id) || [];
    
    // Calculate best price (highest for display - most favorable for holders)
    let bestPrice: number | undefined;
    let bestPriceSource: MarketSource | undefined;
    
    if (prices.length > 0) {
      // Sort by price descending (highest first)
      const sortedPrices = [...prices].sort((a, b) => b.price - a.price);
      bestPrice = sortedPrices[0].price;
      bestPriceSource = sortedPrices[0].source;
    }

    // Try to get price from multiple sources:
    // 1. Best price from price history (most reliable)
    // 2. Current price from outcome record (if available)
    // 3. Calculate from other outcome if binary market (Yes + No should sum to ~1)
    const outcomePrice = bestPrice ?? (outcome.currentPrice ? parseFloat(outcome.currentPrice.toString()) : undefined);

    return {
      id: outcome.id,
      title: outcome.title,
      description: outcome.description || undefined,
      index: outcome.index,
      currentPrice: outcomePrice,
      currentVolume: outcome.currentVolume ? parseFloat(outcome.currentVolume.toString()) : undefined,
      currentLiquidity: outcome.currentLiquidity ? parseFloat(outcome.currentLiquidity.toString()) : undefined,
      isWinning: outcome.isWinning || undefined,
      prices: prices.length > 0 ? prices : undefined,
      bestPrice,
      bestPriceSource,
    };
  }

  async getMarkets(
    filters: MarketFilters,
    page: number,
    limit: number
  ): Promise<{ markets: MarketResponse[]; total: number }> {
    try {
      const where: any = {};

      // Apply filters
      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.tags && filters.tags.length > 0) {
        where.tags = {
          hasSome: filters.tags,
        };
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Source filter through sourceMarkets
      if (filters.source) {
        where.sourceMarkets = {
          some: {
            source: filters.source,
          },
        };
      }

      // Build orderBy
      const orderBy: any = {};
      if (filters.sortBy) {
        switch (filters.sortBy) {
          case 'volume':
            orderBy.totalVolume = filters.sortOrder || 'desc';
            break;
          case 'liquidity':
            orderBy.totalLiquidity = filters.sortOrder || 'desc';
            break;
          case 'endDate':
            orderBy.endDate = filters.sortOrder || 'asc';
            break;
          case 'participantCount':
            orderBy.participantCount = filters.sortOrder || 'desc';
            break;
          case 'createdAt':
          default:
            orderBy.createdAt = filters.sortOrder || 'desc';
            break;
        }
      } else {
        orderBy.createdAt = 'desc';
      }

      const [markets, total] = await Promise.all([
        prisma.market.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            outcomes: {
              orderBy: { index: 'asc' },
            },
            sourceMarkets: true,
          },
        }),
        prisma.market.count({ where }),
      ]);

      // Get all outcome IDs for price lookup
      const outcomeIds = markets.flatMap(m => m.outcomes.map(o => o.id));
      const pricesMap = await this.getOutcomePrices(outcomeIds);

      const marketResponses: MarketResponse[] = markets.map(market => ({
        id: market.id,
        title: market.title,
        description: market.description || undefined,
        category: market.category || undefined,
        tags: Array.isArray(market.tags) ? market.tags as string[] : [],
        createdAt: market.createdAt.toISOString(),
        updatedAt: market.updatedAt.toISOString(),
        endDate: market.endDate?.toISOString(),
        resolutionDate: market.resolutionDate?.toISOString(),
        status: market.status,
        totalVolume: market.totalVolume ? parseFloat(market.totalVolume.toString()) : undefined,
        totalLiquidity: market.totalLiquidity ? parseFloat(market.totalLiquidity.toString()) : undefined,
        participantCount: market.participantCount || undefined,
        resolvedOutcome: market.resolvedOutcome || undefined,
        resolutionSource: market.resolutionSource || undefined,
        outcomes: market.outcomes.map(outcome => this.enrichOutcome(outcome, pricesMap)),
        sourceMarkets: market.sourceMarkets.map(sourceMarket => ({
          id: sourceMarket.id,
          source: sourceMarket.source,
          sourceMarketId: sourceMarket.sourceMarketId,
          isActive: sourceMarket.isActive,
        })),
      }));

      logger.debug('Markets retrieved', { count: marketResponses.length, total, filters });

      return { markets: marketResponses, total };
    } catch (error) {
      logger.error('Failed to get markets', {
        filters,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getMarketById(id: string): Promise<MarketResponse | null> {
    try {
      const market = await prisma.market.findUnique({
        where: { id },
        include: {
          outcomes: {
            orderBy: { index: 'asc' },
          },
          sourceMarkets: true,
        },
      });

      if (!market) {
        return null;
      }

      // Get per-source prices for outcomes
      const outcomeIds = market.outcomes.map(o => o.id);
      const pricesMap = await this.getOutcomePrices(outcomeIds);

      const marketResponse: MarketResponse = {
        id: market.id,
        title: market.title,
        description: market.description || undefined,
        category: market.category || undefined,
        tags: Array.isArray(market.tags) ? market.tags as string[] : [],
        createdAt: market.createdAt.toISOString(),
        updatedAt: market.updatedAt.toISOString(),
        endDate: market.endDate?.toISOString(),
        resolutionDate: market.resolutionDate?.toISOString(),
        status: market.status,
        totalVolume: market.totalVolume ? parseFloat(market.totalVolume.toString()) : undefined,
        totalLiquidity: market.totalLiquidity ? parseFloat(market.totalLiquidity.toString()) : undefined,
        participantCount: market.participantCount || undefined,
        resolvedOutcome: market.resolvedOutcome || undefined,
        resolutionSource: market.resolutionSource || undefined,
        outcomes: market.outcomes.map(outcome => this.enrichOutcome(outcome, pricesMap)),
        sourceMarkets: market.sourceMarkets.map(sourceMarket => ({
          id: sourceMarket.id,
          source: sourceMarket.source,
          sourceMarketId: sourceMarket.sourceMarketId,
          isActive: sourceMarket.isActive,
        })),
      };

      logger.debug('Market retrieved', { id });

      return marketResponse;
    } catch (error) {
      logger.error('Failed to get market by ID', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getActiveMarkets(page: number, limit: number): Promise<{ markets: MarketResponse[]; total: number }> {
    return this.getMarkets({ status: MarketStatus.ACTIVE }, page, limit);
  }

  async getTrendingMarkets(page: number, limit: number): Promise<{ markets: MarketResponse[]; total: number }> {
    try {
      const where = {
        status: MarketStatus.ACTIVE,
        OR: [
          { totalVolume: { gt: 0 } },
          { participantCount: { gt: 0 } },
        ],
      };

      const orderBy = [
        { totalVolume: 'desc' as const },
        { participantCount: 'desc' as const },
        { createdAt: 'desc' as const },
      ];

      const [markets, total] = await Promise.all([
        prisma.market.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            outcomes: {
              orderBy: { index: 'asc' },
            },
            sourceMarkets: true,
          },
        }),
        prisma.market.count({ where }),
      ]);

      // Get all outcome IDs for price lookup
      const outcomeIds = markets.flatMap(m => m.outcomes.map(o => o.id));
      const pricesMap = await this.getOutcomePrices(outcomeIds);

      const marketResponses: MarketResponse[] = markets.map(market => ({
        id: market.id,
        title: market.title,
        description: market.description || undefined,
        category: market.category || undefined,
        tags: Array.isArray(market.tags) ? market.tags as string[] : [],
        createdAt: market.createdAt.toISOString(),
        updatedAt: market.updatedAt.toISOString(),
        endDate: market.endDate?.toISOString(),
        resolutionDate: market.resolutionDate?.toISOString(),
        status: market.status,
        totalVolume: market.totalVolume ? parseFloat(market.totalVolume.toString()) : undefined,
        totalLiquidity: market.totalLiquidity ? parseFloat(market.totalLiquidity.toString()) : undefined,
        participantCount: market.participantCount || undefined,
        resolvedOutcome: market.resolvedOutcome || undefined,
        resolutionSource: market.resolutionSource || undefined,
        outcomes: market.outcomes.map(outcome => this.enrichOutcome(outcome, pricesMap)),
        sourceMarkets: market.sourceMarkets.map(sourceMarket => ({
          id: sourceMarket.id,
          source: sourceMarket.source,
          sourceMarketId: sourceMarket.sourceMarketId,
          isActive: sourceMarket.isActive,
        })),
      }));

      logger.debug('Trending markets retrieved', { count: marketResponses.length, total });

      return { markets: marketResponses, total };
    } catch (error) {
      logger.error('Failed to get trending markets', {
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getMarketPriceHistory(
    marketId: string,
    filters: {
      outcomeId?: string;
      source?: MarketSource;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<PriceHistoryResponse[]> {
    try {
      const where: any = {
        marketId,
      };

      if (filters.outcomeId) {
        where.outcomeId = filters.outcomeId;
      }

      if (filters.source) {
        where.source = filters.source;
      }

      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) {
          where.timestamp.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.timestamp.lte = filters.endDate;
        }
      }

      const priceHistory = await prisma.priceHistory.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
      });

      const priceHistoryResponses: PriceHistoryResponse[] = priceHistory.map(ph => ({
        id: ph.id,
        marketId: ph.marketId,
        outcomeId: ph.outcomeId || undefined,
        source: ph.source,
        price: parseFloat(ph.price.toString()),
        volume: ph.volume ? parseFloat(ph.volume.toString()) : undefined,
        liquidity: ph.liquidity ? parseFloat(ph.liquidity.toString()) : undefined,
        timestamp: ph.timestamp.toISOString(),
      }));

      logger.debug('Price history retrieved', { 
        marketId, 
        count: priceHistoryResponses.length,
        filters 
      });

      return priceHistoryResponses;
    } catch (error) {
      logger.error('Failed to get price history', {
        marketId,
        filters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getMarketCategories(): Promise<string[]> {
    try {
      const categories = await prisma.market.findMany({
        select: { category: true },
        where: {
          category: { not: null },
        },
        distinct: ['category'],
      });

      return categories
        .map(c => c.category)
        .filter((category): category is string => category !== null);
    } catch (error) {
      logger.error('Failed to get market categories', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getMarketTags(): Promise<string[]> {
    try {
      const markets = await prisma.market.findMany({
        select: { tags: true },
        where: {
          tags: { not: Prisma.JsonNull },
        },
      });

      const allTags = new Set<string>();
      markets.forEach(market => {
        if (Array.isArray(market.tags)) {
          (market.tags as string[]).forEach(tag => allTags.add(tag));
        }
      });

      return Array.from(allTags).sort();
    } catch (error) {
      logger.error('Failed to get market tags', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const marketService = new MarketService();
