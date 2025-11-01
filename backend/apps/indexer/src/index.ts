import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { IndexerService } from './core/indexerService.js';

/**
 * Main entry point for the prediction market indexer
 */
async function main() {
  logger.info('Starting Prediction Market Indexer', {
    sources: config.enabledSources,
    pollInterval: config.pollInterval,
  });

  // Initialize the indexer service
  const indexer = new IndexerService();

  // Setup graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await indexer.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start the indexer
  try {
    await indexer.start();
  } catch (error) {
    logger.error('Fatal error starting indexer', { error });
    process.exit(1);
  }
}

main();

