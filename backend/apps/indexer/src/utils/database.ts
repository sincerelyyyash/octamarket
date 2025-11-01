import { PrismaClient } from '@repo/database';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Singleton Prisma client for database operations
 */
class DatabaseClient {
  private static instance: PrismaClient | null = null;

  static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      logger.info('Initializing database client', { url: config.databaseUrl.replace(/:[^:@]+@/, ':****@') });
      DatabaseClient.instance = new PrismaClient({
        datasources: {
          db: {
            url: config.databaseUrl,
          },
        },
        log: config.logLevel === 'debug' ? ['query', 'error', 'warn'] : ['error'],
      });
    }
    return DatabaseClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.$disconnect();
      DatabaseClient.instance = null;
      logger.info('Database client disconnected');
    }
  }
}

export const db: PrismaClient = DatabaseClient.getInstance();

/**
 * Check database connection
 */
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await db.$queryRaw`SELECT 1`;
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error });
    return false;
  }
};

/**
 * Disconnect from database
 */
export const disconnectDatabase = async (): Promise<void> => {
  await DatabaseClient.disconnect();
};

