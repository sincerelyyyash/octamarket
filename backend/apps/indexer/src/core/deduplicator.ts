import type { MarketData, DeduplicationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class MarketDeduplicator {
  private readonly logger = logger.child({ component: 'deduplicator' });

  /**
   * Find potential duplicate markets across sources
   */
  async findDuplicates(
    newMarket: MarketData,
    existingMarkets: MarketData[]
  ): Promise<DeduplicationResult[]> {
    const results: DeduplicationResult[] = [];

    for (const existing of existingMarkets) {
      const confidence = this.calculateSimilarity(newMarket, existing);
      
      if (confidence >= config.deduplication.confidenceThreshold) {
        results.push({
          canonicalMarketId: existing.id,
          duplicateMarkets: [newMarket.id],
          confidence,
        });
      }
    }

    // Sort by confidence (highest first)
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate similarity between two markets
   */
  private calculateSimilarity(market1: MarketData, market2: MarketData): number {
    let totalWeight = 0;
    let matchedWeight = 0;

    // Title similarity (weight: 40%)
    const titleWeight = 0.4;
    const titleSimilarity = this.calculateStringSimilarity(market1.title, market2.title);
    totalWeight += titleWeight;
    matchedWeight += titleSimilarity * titleWeight;

    // Description similarity (weight: 20%)
    if (market1.description && market2.description) {
      const descWeight = 0.2;
      const descSimilarity = this.calculateStringSimilarity(market1.description, market2.description);
      totalWeight += descWeight;
      matchedWeight += descSimilarity * descWeight;
    }

    // End date similarity (weight: 15%)
    if (market1.endDate && market2.endDate) {
      const dateWeight = 0.15;
      const dateSimilarity = this.calculateDateSimilarity(market1.endDate, market2.endDate);
      totalWeight += dateWeight;
      matchedWeight += dateSimilarity * dateWeight;
    }

    // Category similarity (weight: 10%)
    if (market1.category && market2.category) {
      const categoryWeight = 0.1;
      const categorySimilarity = market1.category.toLowerCase() === market2.category.toLowerCase() ? 1 : 0;
      totalWeight += categoryWeight;
      matchedWeight += categorySimilarity * categoryWeight;
    }

    // Outcomes similarity (weight: 15%)
    const outcomesWeight = 0.15;
    const outcomesSimilarity = this.calculateOutcomesSimilarity(market1.outcomes, market2.outcomes);
    totalWeight += outcomesWeight;
    matchedWeight += outcomesSimilarity * outcomesWeight;

    // Normalize by total weight
    return totalWeight > 0 ? matchedWeight / totalWeight : 0;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1, // deletion
          matrix[j - 1]![i]! + 1, // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Calculate date similarity (closer dates = higher similarity)
   */
  private calculateDateSimilarity(date1: Date, date2: Date): number {
    const diffMs = Math.abs(date1.getTime() - date2.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    // Consider dates within 1 day as very similar
    if (diffDays <= 1) return 1;
    // Consider dates within 7 days as somewhat similar
    if (diffDays <= 7) return 0.8;
    // Consider dates within 30 days as slightly similar
    if (diffDays <= 30) return 0.5;
    
    return 0;
  }

  /**
   * Calculate outcomes similarity
   */
  private calculateOutcomesSimilarity(outcomes1: any[], outcomes2: any[]): number {
    if (!outcomes1?.length || !outcomes2?.length) return 0;
    
    // For binary markets
    if (outcomes1.length === 2 && outcomes2.length === 2) {
      const sim1 = this.calculateStringSimilarity(outcomes1[0].title, outcomes2[0].title);
      const sim2 = this.calculateStringSimilarity(outcomes1[1].title, outcomes2[1].title);
      return (sim1 + sim2) / 2;
    }
    
    // For multi-outcome markets, find best matches
    let totalSimilarity = 0;
    let matches = 0;
    
    for (const outcome1 of outcomes1) {
      let bestMatch = 0;
      for (const outcome2 of outcomes2) {
        const similarity = this.calculateStringSimilarity(outcome1.title, outcome2.title);
        bestMatch = Math.max(bestMatch, similarity);
      }
      totalSimilarity += bestMatch;
      matches++;
    }
    
    return matches > 0 ? totalSimilarity / matches : 0;
  }

  /**
   * Merge duplicate markets into canonical representation
   */
  async mergeMarkets(canonicalMarket: MarketData, duplicateMarkets: MarketData[]): Promise<MarketData> {
    const merged = { ...canonicalMarket };
    
    // Aggregate volume and liquidity
    let totalVolume = canonicalMarket.totalVolume ?? 0;
    let totalLiquidity = canonicalMarket.totalLiquidity ?? 0;
    let totalParticipants = canonicalMarket.participantCount ?? 0;
    
    for (const duplicate of duplicateMarkets) {
      totalVolume += duplicate.totalVolume ?? 0;
      totalLiquidity += duplicate.totalLiquidity ?? 0;
      totalParticipants += duplicate.participantCount ?? 0;
    }
    
    merged.totalVolume = totalVolume;
    merged.totalLiquidity = totalLiquidity;
    merged.participantCount = totalParticipants;
    
    // Use the most recent resolution data
    for (const duplicate of duplicateMarkets) {
      if (duplicate.resolvedOutcome && !merged.resolvedOutcome) {
        merged.resolvedOutcome = duplicate.resolvedOutcome;
        merged.resolutionSource = duplicate.resolutionSource;
        merged.resolutionDate = duplicate.resolutionDate;
      }
    }
    
    this.logger.info('Merged duplicate markets', {
      canonicalId: canonicalMarket.id,
      duplicateIds: duplicateMarkets.map(m => m.id),
      totalVolume,
      totalLiquidity,
    });
    
    return merged;
  }
}
