export type EngineConfig = {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    intentsStream: string;
    dlqStream: string;
    consumerGroup: string;
    consumerName: string;
    visibilityMs: number;
  };
  server: {
    baseUrl: string;
    internalToken?: string;
  };
  signer: {
    baseUrl: string;
    mtls?: boolean;
  };
};

export const getConfig = (): EngineConfig => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    intentsStream: process.env.TRADES_INTENTS_STREAM || 'trades.intents',
    dlqStream: process.env.TRADES_DLQ_STREAM || 'trades.dlq',
    consumerGroup: process.env.TRADES_CONSUMER_GROUP || 'engine-workers',
    consumerName: process.env.TRADES_CONSUMER_NAME || `engine-${process.pid}`,
    visibilityMs: parseInt(process.env.TRADES_VISIBILITY_MS || '30000', 10),
  },
  server: {
    baseUrl: process.env.SERVER_BASE_URL || 'http://localhost:3001',
    internalToken: process.env.SERVER_INTERNAL_TOKEN,
  },
  signer: {
    baseUrl: process.env.SIGNER_BASE_URL || 'http://localhost:8081',
    mtls: process.env.SIGNER_MTLS === 'true',
  },
});


