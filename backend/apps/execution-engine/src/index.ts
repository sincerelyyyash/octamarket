import dotenv from 'dotenv';
dotenv.config();

import { createLogger, format, transports } from 'winston';
import { getConfig } from './lib/config.js';
import { createRedisClient } from './lib/redis.js';
import { startConsumer } from './queue/consumer.js';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  transports: [new transports.Console({ format: format.simple() })],
});

async function main() {
  const config = getConfig();
  logger.info('Starting execution engine', { env: process.env.NODE_ENV || 'development' });

  const redis = createRedisClient({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  });

  // Health checks
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down');
    await redis.quit();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down');
    await redis.quit();
    process.exit(0);
  });

  await startConsumer({ logger, redis, config });

  logger.info('Execution engine is running');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Engine failed to start', err);
  process.exit(1);
});


