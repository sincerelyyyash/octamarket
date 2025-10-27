import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './src/config/index.js';
import { logger, requestLogger } from './src/utils/logger.js';
import { redis } from './src/utils/redis.js';
import { prisma } from '@repo/database';

// Import middleware
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';
import { generalRateLimit, authRateLimit } from './src/middleware/rateLimiter.js';

// Import routes
import authRoutes from './src/routes/auth.js';
import marketRoutes from './src/routes/markets.js';
import leaderboardRoutes from './src/routes/leaderboard.js';
import traderRoutes from './src/routes/traders.js';
import copyTradingRoutes from './src/routes/copy-trading.js';
import statsRoutes from './src/routes/stats.js';

class Server {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS middleware
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          requestLogger.info(message.trim());
        },
      },
    }));

    // Rate limiting
    this.app.use(generalRateLimit);

    // Health check endpoint (before other routes)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.server.environment,
        },
      });
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRateLimit, authRoutes);
    this.app.use('/api/markets', marketRoutes);
    this.app.use('/api/leaderboard', leaderboardRoutes);
    this.app.use('/api/traders', traderRoutes);
    this.app.use('/api/copy-trading', copyTradingRoutes);
    this.app.use('/api/stats', statsRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          message: 'OctaMarkets API Server',
          version: '1.0.0',
          environment: config.server.environment,
          endpoints: {
            auth: '/api/auth',
            markets: '/api/markets',
            leaderboard: '/api/leaderboard',
            traders: '/api/traders',
            copyTrading: '/api/copy-trading',
            stats: '/api/stats',
          },
        },
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    try {
      // Test database connection
      await prisma.$connect();
      logger.info('Database connected successfully');

      // Test Redis connection
      await redis.getClient().ping();
      logger.info('Redis connected successfully');

      // Start server
      this.server = this.app.listen(config.server.port, config.server.host, () => {
        logger.info('OctaMarkets API Server started', {
          port: config.server.port,
          host: config.server.host,
          environment: config.server.environment,
        });
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Shutting down server...');

      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server.close((err: any) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      // Close database connection
      await prisma.$disconnect();
      logger.info('Database disconnected');

      // Close Redis connection
      await redis.disconnect();
      logger.info('Redis disconnected');

      logger.info('Server shutdown complete');
    } catch (error) {
      logger.error('Error during server shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { 
        error: error.message, 
        stack: error.stack 
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { 
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: promise.toString(),
      });
      process.exit(1);
    });
  }
}

// Start the server
const server = new Server();

server.start().catch((error) => {
  logger.error('Failed to start application', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

export default server;