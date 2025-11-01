import { MarketSource } from '@repo/database';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';

/**
 * Manages indexer state and sync tracking
 */
export class IndexerStateManager {
  /**
   * Get current state for a source
   */
  async getState(source: MarketSource) {
    try {
      const state = await db.indexerState.findUnique({
        where: { source },
      });

      return state;
    } catch (error) {
      logger.error('Error getting indexer state', { source, error });
      return null;
    }
  }

  /**
   * Update sync state for a source
   */
  async updateSyncState(source: MarketSource, additionalData?: {
    lastBlockNumber?: bigint;
    lastEventId?: string;
    lastTradeSyncAt?: Date;
  }): Promise<void> {
    try {
      await db.indexerState.upsert({
        where: { source },
        create: {
          source,
          lastSyncAt: new Date(),
          isActive: true,
          errorCount: 0,
          ...additionalData,
        },
        update: {
          lastSyncAt: new Date(),
          isActive: true,
          errorCount: 0,
          lastError: null,
          ...additionalData,
        },
      });

      logger.debug('Updated sync state', { source });
    } catch (error) {
      logger.error('Error updating sync state', { source, error });
    }
  }

  /**
   * Record an error for a source
   */
  async recordError(source: MarketSource, error: Error): Promise<void> {
    try {
      const currentState = await this.getState(source);
      const errorCount = (currentState?.errorCount || 0) + 1;

      await db.indexerState.upsert({
        where: { source },
        create: {
          source,
          isActive: errorCount < 10, // Deactivate after 10 errors
          errorCount,
          lastError: error.message,
        },
        update: {
          isActive: errorCount < 10,
          errorCount,
          lastError: error.message,
        },
      });

      logger.warn('Recorded error for source', { source, errorCount, error: error.message });
    } catch (err) {
      logger.error('Error recording error state', { source, error: err });
    }
  }

  /**
   * Reset error count for a source
   */
  async resetErrors(source: MarketSource): Promise<void> {
    try {
      await db.indexerState.update({
        where: { source },
        data: {
          errorCount: 0,
          lastError: null,
          isActive: true,
        },
      });

      logger.info('Reset errors for source', { source });
    } catch (error) {
      logger.error('Error resetting error state', { source, error });
    }
  }

  /**
   * Check if a source should be synced (not recently synced)
   */
  async shouldSync(source: MarketSource, minIntervalMs: number = 60000): Promise<boolean> {
    try {
      const state = await this.getState(source);

      if (!state) {
        return true; // No state = never synced
      }

      if (!state.isActive) {
        logger.warn('Source is inactive', { source });
        return false;
      }

      if (!state.lastSyncAt) {
        return true;
      }

      const timeSinceLastSync = Date.now() - state.lastSyncAt.getTime();
      return timeSinceLastSync >= minIntervalMs;
    } catch (error) {
      logger.error('Error checking sync eligibility', { source, error });
      return true; // On error, allow sync attempt
    }
  }

  /**
   * Get last sync timestamp for a source
   */
  async getLastSyncTimestamp(source: MarketSource): Promise<Date | null> {
    try {
      const state = await this.getState(source);
      return state?.lastSyncAt || null;
    } catch (error) {
      logger.error('Error getting last sync timestamp', { source, error });
      return null;
    }
  }

  /**
   * Initialize state for all enabled sources
   */
  async initializeStates(sources: MarketSource[]): Promise<void> {
    try {
      for (const source of sources) {
        await db.indexerState.upsert({
          where: { source },
          create: {
            source,
            isActive: true,
            errorCount: 0,
          },
          update: {
            isActive: true,
          },
        });
      }

      logger.info('Initialized indexer states', { sources });
    } catch (error) {
      logger.error('Error initializing states', { error });
    }
  }

  /**
   * Get all active sources
   */
  async getActiveSources(): Promise<MarketSource[]> {
    try {
      const states = await db.indexerState.findMany({
        where: { isActive: true },
      });

      return states.map((s) => s.source);
    } catch (error) {
      logger.error('Error getting active sources', { error });
      return [];
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    try {
      const states = await db.indexerState.findMany();

      return states.map((state) => ({
        source: state.source,
        isActive: state.isActive,
        lastSyncAt: state.lastSyncAt,
        errorCount: state.errorCount,
        lastError: state.lastError,
      }));
    } catch (error) {
      logger.error('Error getting sync stats', { error });
      return [];
    }
  }
}

