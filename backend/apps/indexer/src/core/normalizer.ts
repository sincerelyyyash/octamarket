import { MarketSource, MarketStatus } from '@repo/database';
import type { MarketData, NormalizedMarket, NormalizationError } from '../types/index.js';
import { NormalizationError as NormalizationErrorClass } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class MarketNormalizer {
  private readonly logger = logger.child({ component: 'normalizer' });

  /**
   * Normalize market data from different sources into canonical format
   */
  async normalizeMarket(
    sourceData: any,
    source: MarketSource,
    sourceMarketId: string
  ): Promise<NormalizedMarket> {
    try {
      let marketData: MarketData;
      let confidence = 1.0;

      switch (source) {
        case MarketSource.POLYMARKET:
          marketData = this.normalizePolymarket(sourceData);
          break;
        case MarketSource.KALSHI:
          marketData = this.normalizeKalshi(sourceData);
          break;
        case MarketSource.AUGUR:
          marketData = this.normalizeAugur(sourceData);
          break;
        case MarketSource.THALES:
          marketData = this.normalizeThales(sourceData);
          break;
        case MarketSource.OMEN:
          marketData = this.normalizeOmen(sourceData);
          break;
        default:
          throw new NormalizationErrorClass(`Unsupported source: ${source}`, source);
      }

      return {
        sourceMarketId,
        source,
        marketData,
        confidence,
      };
    } catch (error) {
      this.logger.error('Failed to normalize market', {
        source,
        sourceMarketId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new NormalizationErrorClass(
        `Failed to normalize market from ${source}`,
        source,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private normalizePolymarket(data: any): MarketData {
    // Handle outcomes - they might be in different formats
    let outcomes: any[] = [];
    
    if (data.outcomes && Array.isArray(data.outcomes)) {
      outcomes = data.outcomes.map((outcome: any, index: number) => {
        const title =
          typeof outcome === 'string'
            ? outcome
            : outcome?.name || outcome?.title || `Outcome ${index + 1}`;
        const price =
          typeof outcome === 'object' && outcome?.price != null
            ? parseFloat(outcome.price)
            : undefined;
        const volume =
          typeof outcome === 'object' && outcome?.volume != null
            ? parseFloat(outcome.volume)
            : undefined;
        const liquidity =
          typeof outcome === 'object' && outcome?.liquidity != null
            ? parseFloat(outcome.liquidity)
            : undefined;
        return {
          title,
          description: typeof outcome === 'object' ? outcome?.description : undefined,
          index,
          currentPrice: price,
          currentVolume: volume,
          currentLiquidity: liquidity,
        };
      });
    } else if (data.tokens && Array.isArray(data.tokens)) {
      // Alternative format with tokens
      outcomes = data.tokens.map((token: any, index: number) => ({
        title: token.outcome || `Outcome ${index + 1}`,
        description: undefined,
        index,
        currentPrice: token.price ? parseFloat(token.price) : undefined,
        currentVolume: undefined,
        currentLiquidity: undefined,
      }));
    }

    // Use event title as fallback if market doesn't have a question
    // Be defensive: some sources may provide arrays/objects here; ensure we return a clean string
    const pickTitle = (value: any): string | undefined => {
      if (!value) return undefined;
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) {
        const firstString = value.find((v) => typeof v === 'string');
        if (firstString) return firstString;
        // As a very last resort, stringify the first item
        return String(value[0]);
      }
      if (typeof value === 'object' && typeof value.title === 'string') return value.title;
      return undefined;
    };

    const title =
      pickTitle(data.question) ||
      pickTitle(data.title) ||
      pickTitle(data.event_title) ||
      'Unknown Market';

    const pickDescription = (value: any): string | undefined => {
      if (!value) return undefined;
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && typeof value.description === 'string') return value.description;
      return undefined;
    };

    const description = pickDescription(data.description) || pickDescription(data.event_description);

    return {
      id: data.condition_id || data.id,
      title,
      description,
      category: data.category,
      tags: data.tags || [],
      endDate: data.end_date_iso || data.end_date ? new Date(data.end_date_iso || data.end_date) : undefined,
      resolutionDate: data.resolution_date ? new Date(data.resolution_date) : undefined,
      status: this.mapPolymarketStatus(data.closed, data.resolved),
      totalVolume: data.volume ? parseFloat(data.volume) : undefined,
      totalLiquidity: data.liquidity ? parseFloat(data.liquidity) : undefined,
      participantCount: data.participant_count,
      resolvedOutcome: data.winning_outcome,
      resolutionSource: data.resolution_source,
      outcomes,
    };
  }

  private normalizeKalshi(data: any): MarketData {
    const outcomes = data.yes_ask && data.no_ask ? [
      {
        title: 'Yes',
        index: 0,
        currentPrice: parseFloat(data.yes_bid || data.yes_ask) / 100,
        currentVolume: data.yes_volume ? parseFloat(data.yes_volume) : undefined,
      },
      {
        title: 'No',
        index: 1,
        currentPrice: parseFloat(data.no_bid || data.no_ask) / 100,
        currentVolume: data.no_volume ? parseFloat(data.no_volume) : undefined,
      },
    ] : [];

    // Format description for parlay markets
    let description = data.subtitle || data.description;
    if (description && typeof description === 'string') {
      description = this.formatKalshiDescription(description);
    }

    return {
      id: data.ticker || data.id,
      title: data.title || data.question,
      description,
      category: data.category,
      tags: data.tags || [],
      endDate: data.expiration_time ? new Date(data.expiration_time) : undefined,
      resolutionDate: data.resolution_time ? new Date(data.resolution_time) : undefined,
      status: this.mapKalshiStatus(data.status),
      totalVolume: data.volume ? parseFloat(data.volume) : undefined,
      participantCount: data.open_interest,
      resolvedOutcome: data.result,
      outcomes,
    };
  }

  private formatKalshiDescription(description: string): string {
    // Check if this is a comma-separated list of conditions (parlay market)
    // Pattern: "yes PlayerName: Stat,no PlayerName: Stat,..."
    const conditionPattern = /^(yes|no)\s+\w+.*?,/i;
    
    if (!conditionPattern.test(description)) {
      // Not a parlay market, return as-is
      return description;
    }

    // Parse and format conditions
    const conditions = description.split(',').filter(c => c.trim());
    
    // Format each condition by removing the yes/no prefix and joining with newlines
    const formattedConditions = conditions.map(condition => {
      const trimmed = condition.trim();
      // Remove "yes " or "no " prefix
      const cleaned = trimmed.replace(/^(yes|no)\s+/i, '');
      return cleaned;
    });

    // Join with newlines for better readability
    return formattedConditions.join('\n');
  }

  private normalizeAugur(data: any): MarketData {
    const outcomes = data.outcomes?.map((outcome: any, index: number) => ({
      title: outcome.description || `Outcome ${index + 1}`,
      index,
      currentPrice: outcome.price ? parseFloat(outcome.price) : undefined,
      currentVolume: outcome.volume ? parseFloat(outcome.volume) : undefined,
    })) || [];

    return {
      id: data.id,
      title: data.description || data.extraInfo?.description,
      description: data.extraInfo?.longDescription,
      category: data.category,
      tags: data.extraInfo?.tags || [],
      endDate: data.endTime ? new Date(parseInt(data.endTime) * 1000) : undefined,
      resolutionDate: data.finalizationTime ? new Date(parseInt(data.finalizationTime) * 1000) : undefined,
      status: this.mapAugurStatus(data.marketStatus),
      totalVolume: data.volume ? parseFloat(data.volume) : undefined,
      outcomes,
    };
  }

  private normalizeThales(data: any): MarketData {
    const outcomes = [
      {
        title: 'Up',
        index: 0,
        currentPrice: data.homeOdds ? 1 / parseFloat(data.homeOdds) : undefined,
      },
      {
        title: 'Down',
        index: 1,
        currentPrice: data.awayOdds ? 1 / parseFloat(data.awayOdds) : undefined,
      },
    ];

    return {
      id: data.address || data.id,
      title: data.question || `${data.homeTeam} vs ${data.awayTeam}`,
      description: data.description,
      category: data.sport || data.category,
      endDate: data.maturityDate ? new Date(data.maturityDate) : undefined,
      resolutionDate: data.resolvedTime ? new Date(data.resolvedTime) : undefined,
      status: this.mapThalesStatus(data.isResolved, data.isPaused),
      totalVolume: data.totalVolume ? parseFloat(data.totalVolume) : undefined,
      resolvedOutcome: data.finalResult,
      outcomes,
    };
  }

  private normalizeOmen(data: any): MarketData {
    const outcomes = data.outcomes?.map((outcome: any, index: number) => ({
      title: outcome.title || `Outcome ${index + 1}`,
      index,
      currentPrice: outcome.currentPrice ? parseFloat(outcome.currentPrice) : undefined,
    })) || [];

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category?.name,
      endDate: data.openingTimestamp ? new Date(parseInt(data.openingTimestamp) * 1000) : undefined,
      resolutionDate: data.resolutionTimestamp ? new Date(parseInt(data.resolutionTimestamp) * 1000) : undefined,
      status: this.mapOmenStatus(data.currentAnswer, data.isPendingArbitration),
      totalVolume: data.usdVolume ? parseFloat(data.usdVolume) : undefined,
      totalLiquidity: data.usdLiquidity ? parseFloat(data.usdLiquidity) : undefined,
      outcomes,
    };
  }

  private mapPolymarketStatus(closed: boolean, resolved: boolean): MarketStatus {
    if (resolved) return MarketStatus.RESOLVED;
    if (closed) return MarketStatus.CANCELLED;
    return MarketStatus.ACTIVE;
  }

  private mapKalshiStatus(status: string): MarketStatus {
    switch (status?.toLowerCase()) {
      case 'open':
        return MarketStatus.ACTIVE;
      case 'closed':
        return MarketStatus.RESOLVED;
      case 'settled':
        return MarketStatus.RESOLVED;
      default:
        return MarketStatus.ACTIVE;
    }
  }

  private mapAugurStatus(status: string): MarketStatus {
    switch (status) {
      case 'TRADING':
        return MarketStatus.ACTIVE;
      case 'REPORTING':
      case 'DISPUTING':
        return MarketStatus.PAUSED;
      case 'FINALIZED':
        return MarketStatus.RESOLVED;
      default:
        return MarketStatus.ACTIVE;
    }
  }

  private mapThalesStatus(isResolved: boolean, isPaused: boolean): MarketStatus {
    if (isResolved) return MarketStatus.RESOLVED;
    if (isPaused) return MarketStatus.PAUSED;
    return MarketStatus.ACTIVE;
  }

  private mapOmenStatus(currentAnswer: string, isPendingArbitration: boolean): MarketStatus {
    if (currentAnswer && !isPendingArbitration) return MarketStatus.RESOLVED;
    if (isPendingArbitration) return MarketStatus.PAUSED;
    return MarketStatus.ACTIVE;
  }
}
