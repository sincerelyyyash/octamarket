import dotenv from 'dotenv';

// Load env from backend root first, then local .env in app if present
dotenv.config({ path: '../../.env' });
dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001'),
    environment: process.env.NODE_ENV || 'development',
    host: process.env.HOST || 'localhost',
    internalToken: process.env.SERVER_INTERNAL_TOKEN,
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/octamarkets',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: (() => {
      const raw = (process.env.REDIS_DB ?? '').trim();
      const parsed = parseInt(raw === '' ? '0' : raw, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    })(),
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultPage: 1,
  },
  cache: {
    ttl: {
      markets: 30, // 30 seconds
      leaderboards: 300, // 5 minutes
      traders: 300, // 5 minutes
      stats: 600, // 10 minutes
      auth: 60, // 1 minute
    },
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    authenticatedMax: 1000, // authenticated users get higher limits
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE,
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    usdcMint: process.env.SOLANA_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    treasuryAddress: process.env.SOLANA_TREASURY_ADDRESS || '',
    webhookSecret: process.env.SOLANA_WEBHOOK_SECRET || '',
  },
} as const;

export type Config = typeof config;
