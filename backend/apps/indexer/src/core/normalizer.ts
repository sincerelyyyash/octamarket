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
            : outcome?.name || outcome?.title || outcome?.outcome || `Outcome ${index + 1}`;
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
      // Alternative format with tokens from CLOB API
      outcomes = data.tokens.map((token: any, index: number) => {
        // Tokens from CLOB API have outcome name and price info
        const title = token.outcome || token.name || `Outcome ${index + 1}`;
        // Get price - Polymarket API returns price directly (0-1 range)
        // For closed markets, price is 0 or 1, for active markets it's the current price
        const price = token.price !== undefined 
          ? parseFloat(token.price)
          : token.bestBid !== undefined 
          ? parseFloat(token.bestBid)
          : token.bestAsk !== undefined
          ? parseFloat(token.bestAsk)
          : undefined;
        
        return {
          title,
          description: token.description || undefined,
          index,
          currentPrice: price,
          currentVolume: token.volume ? parseFloat(token.volume) : undefined,
          currentLiquidity: token.liquidity ? parseFloat(token.liquidity) : undefined,
        };
      });
    }
    
    // For binary markets, ensure we have Yes/No outcomes even if tokens/outcomes aren't provided
    // Most Polymarket markets are binary (Yes/No)
    if (outcomes.length === 0) {
      // Check if this looks like a binary market
      const question = data.question || data.title || data.event_title || '';
      const isBinaryMarket = !question.includes(',') && 
                             !question.includes(';') &&
                             (!data.tokens || data.tokens.length <= 2);
      
      if (isBinaryMarket) {
        // Create Yes/No outcomes as fallback
        outcomes = [
          {
            title: 'Yes',
            index: 0,
            currentPrice: undefined,
            currentVolume: undefined,
            currentLiquidity: undefined,
          },
          {
            title: 'No',
            index: 1,
            currentPrice: undefined,
            currentVolume: undefined,
            currentLiquidity: undefined,
          },
        ];
      }
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

    // Extract CLOB token IDs for price tracking
    let clobTokenIds: string[] = [];
    if (data.clobTokenIds && Array.isArray(data.clobTokenIds)) {
      clobTokenIds = data.clobTokenIds;
    } else if (data.tokens && Array.isArray(data.tokens)) {
      clobTokenIds = data.tokens
        .map((t: any) => t.token_id || t.tokenId)
        .filter((id: any) => id);
    }

    // Use event-level category and tags if market-level ones aren't available
    const category = data.category || data.event_category;
    const tags = data.tags || data.event_tags || [];

    return {
      id: data.conditionId || data.condition_id || data.id,
      title,
      description,
      category,
      tags,
      endDate: data.end_date_iso || data.end_date ? new Date(data.end_date_iso || data.end_date) : undefined,
      resolutionDate: data.resolution_date ? new Date(data.resolution_date) : undefined,
      status: this.mapPolymarketStatus(data.closed, data.resolved, data.archived),
      totalVolume: data.volume ? parseFloat(data.volume) : undefined,
      totalLiquidity: data.liquidity ? parseFloat(data.liquidity) : undefined,
      participantCount: data.participant_count,
      resolvedOutcome: data.winning_outcome,
      resolutionSource: data.resolution_source,
      outcomes,
      // Store clobTokenIds in a way that can be accessed by the database manager
      clobTokenIds: clobTokenIds.length > 0 ? clobTokenIds : undefined,
    } as any; // Use 'as any' to allow the extra field
  }

  private normalizeKalshi(data: any): MarketData {
    const title = data.title || data.question || '';
    const subtitle = data.subtitle || '';
    const description = data.description || '';
    
    // Check if title is a parlay condition (starts with "yes " or "no " followed by a name)
    const parlayConditionPattern = /^(yes|no)\s+\w+/i;
    const isParlayCondition = parlayConditionPattern.test(title);
    
    let marketTitle = title;
    let marketDescription = subtitle || description;
    let outcomes: any[] = [];

    if (isParlayCondition) {
      // This is a parlay market condition - extract proper market title
      // Strategy: Try multiple sources and patterns to find a meaningful title
      
      // 0. First priority: Use event title if available (from event API lookup)
      if (data.event_title && typeof data.event_title === 'string') {
        marketTitle = data.event_title.trim();
        // Use event subtitle if available for description
        if (data.event_subtitle) {
          marketDescription = data.event_subtitle;
        }
        // Use event category if available - also set it as category for fallback logic
        if (data.event_category) {
          // Set category from event if market doesn't have one
          if (!data.category) {
            data.category = data.event_category;
          }
          // Combine event title with category if category not already in title
          if (!marketTitle.toLowerCase().includes(data.event_category.toLowerCase())) {
            marketTitle = `${data.event_category}: ${marketTitle}`;
          }
        }
      }
      // Also use event_category as category for fallback if no event_title
      else if (data.event_category && !data.category) {
        data.category = data.event_category;
      }
      // 1. Check subtitle if it's not a parlay condition
      else if (subtitle && !parlayConditionPattern.test(subtitle)) {
        marketTitle = subtitle.trim();
      } 
      // 2. Check description - try to extract title before parlay conditions
      else if (description && typeof description === 'string') {
        // Check if description has text before the parlay conditions
        // Pattern: "Market Title: yes Player1, yes Player2" or "Market Title - yes Player1, yes Player2"
        const descriptionMatch = description.match(/^([^,]+?)(?:\s*[:-]\s*|\s+)(yes|no)\s+\w+/i);
        if (descriptionMatch && descriptionMatch[1]) {
          const extractedTitle = descriptionMatch[1].trim();
          if (extractedTitle && extractedTitle.length > 5 && !parlayConditionPattern.test(extractedTitle)) {
            marketTitle = extractedTitle;
          }
        }
        // If description doesn't start with parlay pattern, might be a title
        else if (!parlayConditionPattern.test(description) && description.length < 200) {
          marketTitle = description.trim();
        }
      }
      // 3. Try to extract title from question if different from title
      if (marketTitle === title && data.question && data.question !== title) {
        if (!parlayConditionPattern.test(data.question)) {
          marketTitle = data.question.trim();
        }
      }
      // 4. Extract title from parlay conditions themselves (derive from player names/pattern)
      // Only if we haven't found a good title yet (still matches parlay condition pattern or is too generic)
      // Skip this if we already have an event_title from the event API
      if (!data.event_title && (marketTitle === title || parlayConditionPattern.test(marketTitle))) {
        const parlayDescription = subtitle || description || title;
        if (parlayDescription && typeof parlayDescription === 'string') {
          // Try to find common pattern: all conditions have similar structure
          // e.g., "yes Kayshon Boutte, yes Jonathan Taylor" -> "Player Props Parlay"
          const conditions = parlayDescription.split(',').filter((c: string) => c.trim());
          
          if (conditions.length > 0 && conditions[0]) {
            // Extract player/entity name from first condition
            const firstCondition = conditions[0].trim();
            const playerMatch = firstCondition.match(/^(yes|no)\s+(.+)/i);
            
            if (playerMatch && playerMatch[1] && playerMatch[2]) {
              const playerName = playerMatch[2].trim();
              
              // Check if conditions have stats (pattern: "PlayerName: Stat")
              const hasStats = playerName.includes(':');
              
              if (hasStats) {
                // Extract stat type from multiple conditions to find common stat
                // e.g., "Kayshon Boutte: 50+ Receiving Yards" -> "50+ Receiving Yards Parlay"
                const statTypes = new Set<string>();
                conditions.forEach((cond: string) => {
                  const match = cond.trim().match(/^(yes|no)\s+.+?:\s*(.+)/i);
                  if (match && match[2]) {
                    statTypes.add(match[2].trim());
                  }
                });
                
                if (statTypes.size === 1) {
                  // All conditions share the same stat type
                  const statType = Array.from(statTypes)[0];
                  marketTitle = data.category 
                    ? `${data.category}: ${statType}`
                    : statType;
                } else {
                  // Mixed stat types - use category or generic
                  marketTitle = data.category 
                    ? `${data.category} Player Props`
                    : `Player Props Parlay`;
                }
              } else {
                // Just player names - check if they're all similar (all start with capital letter, likely player names)
                const allArePlayerNames = conditions.every((cond: string) => {
                  const match = cond.trim().match(/^(yes|no)\s+([A-Z][a-zA-Z\s]+)/);
                  return match !== null;
                });
                
                if (allArePlayerNames) {
                  if (conditions.length === 1) {
                    // Single condition - use player name
                    marketTitle = `${playerName} Prop`;
                  } else {
                    // Multiple player conditions - create descriptive title with player names
                    // Extract all player names from conditions
                    const playerNames: string[] = [];
                    conditions.forEach((cond: string) => {
                      const match = cond.trim().match(/^(yes|no)\s+(.+)/i);
                      if (match && match[1] && match[2]) {
                        const name = match[2].trim();
                        // Remove any stat suffixes (e.g., ": 50+ Yards")
                        const nameParts = name.split(':');
                        const cleanName = (nameParts[0] || name).trim();
                        if (cleanName && !playerNames.includes(cleanName)) {
                          playerNames.push(cleanName);
                        }
                      }
                    });
                    
                    if (playerNames.length > 0) {
                      // Create title with first few player names (limit to avoid too long titles)
                      const displayNames = playerNames.slice(0, 3);
                      const namesText = displayNames.join(', ');
                      const moreCount = playerNames.length > 3 ? ` +${playerNames.length - 3} more` : '';
                      marketTitle = data.category 
                        ? `${data.category}: ${namesText}${moreCount}`
                        : `Player Props: ${namesText}${moreCount}`;
                    } else {
                      // Fallback if name extraction fails
                      marketTitle = data.category 
                        ? `${data.category} Player Props`
                        : `Player Props Parlay`;
                    }
                  }
                } else {
                  // Mixed or unclear pattern - try to extract meaningful parts
                  const firstFewConditions = conditions.slice(0, 3).map((cond: string) => {
                    const match = cond.trim().match(/^(yes|no)\s+(.+)/i);
                    if (match && match[1] && match[2]) {
                      const nameParts = match[2].trim().split(':');
                      return (nameParts[0] || match[2]).trim();
                    }
                    return null;
                  }).filter((name: string | null): name is string => name !== null);
                  
                  if (firstFewConditions.length > 0) {
                    const namesText = firstFewConditions.join(', ');
                    marketTitle = data.category 
                      ? `${data.category}: ${namesText}${conditions.length > 3 ? ` +${conditions.length - 3} more` : ''}`
                      : namesText + (conditions.length > 3 ? ` +${conditions.length - 3} more` : '');
                  } else {
                    // Final fallback
                    marketTitle = data.category 
                      ? `${data.category} Parlay`
                      : `Parlay Market`;
                  }
                }
              }
            }
          }
        }
      }
      // 5. Fallback to category-based title (only if we don't have event_title)
      if (!data.event_title && (marketTitle === title || marketTitle === 'Parlay Market') && data.category) {
        marketTitle = `${data.category} Parlay`;
      }
      // 6. Final fallback (only if we don't have event_title)
      if (!data.event_title && (marketTitle === title || marketTitle === 'Parlay Market')) {
        marketTitle = 'Parlay Market';
      }

      // Parse parlay conditions from description/subtitle OR title (if title contains parlay conditions)
      let parlayDescription = subtitle || description || '';
      
      // If title itself contains parlay conditions (comma-separated), use it as description source
      if (isParlayCondition && title.includes(',')) {
        parlayDescription = title;
      }
      
      if (parlayDescription && typeof parlayDescription === 'string') {
        const conditionPattern = /^(yes|no)\s+\w+.*?,/i;
        
        // Check if this is a comma-separated list of parlay conditions
        if (conditionPattern.test(parlayDescription) || parlayDescription.includes(',')) {
          // This is a comma-separated list of parlay conditions
          const conditions = parlayDescription.split(',').filter((c: string) => c.trim());
          
          // Create outcomes from each condition
          outcomes = conditions.map((condition: string, index: number) => {
            const trimmed = condition.trim();
            // Extract the condition type (yes/no) and the condition text
            const match = trimmed.match(/^(yes|no)\s+(.+)/i);
            if (match && match[1] && match[2]) {
              const conditionType = match[1];
              const conditionText = match[2];
              return {
                title: conditionText.trim(),
                description: `Condition ${index + 1}: ${conditionType.toUpperCase()}`,
                index,
                currentPrice: undefined, // Parlay conditions don't have individual prices
                currentVolume: undefined,
              };
            }
            // Fallback if pattern doesn't match
            return {
              title: trimmed.replace(/^(yes|no)\s+/i, ''),
              description: trimmed,
              index,
              currentPrice: undefined,
              currentVolume: undefined,
            };
          });
          
          // Format description for display
          marketDescription = this.formatKalshiDescription(parlayDescription);
        } else {
          // Single parlay condition - create outcome from current title
          const match = title.match(/^(yes|no)\s+(.+)/i);
          if (match && match[1] && match[2]) {
            const conditionType = match[1];
            const conditionText = match[2];
            outcomes = [{
              title: conditionText.trim(),
              description: `Condition: ${conditionType.toUpperCase()}`,
              index: 0,
              currentPrice: undefined,
              currentVolume: undefined,
            }];
            marketDescription = conditionText.trim();
          }
        }
      }
    } else {
      // Regular binary market - use standard Yes/No outcomes
      // Always create Yes/No outcomes for binary markets, even if prices are missing
      if (data.yes_ask && data.no_ask) {
        outcomes = [
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
        ];
      } else {
        // Fallback: create Yes/No outcomes even if prices are missing
        // This ensures binary markets always have outcomes displayed
        outcomes = [
          {
            title: 'Yes',
            index: 0,
            currentPrice: undefined,
            currentVolume: data.yes_volume ? parseFloat(data.yes_volume) : undefined,
          },
          {
            title: 'No',
            index: 1,
            currentPrice: undefined,
            currentVolume: data.no_volume ? parseFloat(data.no_volume) : undefined,
          },
        ];
      }

      // Format description for regular markets (in case it contains parlay info)
      if (marketDescription && typeof marketDescription === 'string') {
        marketDescription = this.formatKalshiDescription(marketDescription);
      }
    }

    return {
      id: data.ticker || data.id,
      title: marketTitle,
      description: marketDescription,
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

  private mapPolymarketStatus(closed: boolean, resolved: boolean, archived?: boolean): MarketStatus {
    if (resolved) return MarketStatus.RESOLVED;
    if (archived) return MarketStatus.CANCELLED;
    if (closed) return MarketStatus.RESOLVED; // Closed markets should be marked as resolved
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
