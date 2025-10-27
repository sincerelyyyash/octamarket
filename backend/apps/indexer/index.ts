import { IndexerService } from './src/core/indexerService.js';
import { logger } from './src/utils/logger.js';
import { config } from './src/config/index.js';

async function main() {
  logger.info('Starting OctaMarkets Indexer', {
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    enabledSources: config.sources.filter(s => s.enabled).map(s => s.source),
  });

  const indexer = new IndexerService();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      await indexer.stop();
      logger.info('Indexer service stopped successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { 
      reason: reason instanceof Error ? reason.message : String(reason),
      promise: promise.toString(),
    });
    process.exit(1);
  });

  try {
    // Start the indexer service
    await indexer.start();

    // Log status periodically
    setInterval(() => {
      const status = indexer.getStatus();
      logger.info('Indexer status', {
        isRunning: status.isRunning,
        activeSources: status.sources.filter(s => s.isActive).length,
        totalSources: status.sources.length,
        queueStats: status.queueStats,
      });
    }, 60000); // Every minute

    logger.info('OctaMarkets Indexer is running successfully');
  } catch (error) {
    logger.error('Failed to start indexer service', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error('Application startup failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});