import Redis from 'ioredis';
import { config } from '../config/index.js';

const client = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  enableReadyCheck: true,
});

export const tradeIntents = {
  async enqueue(fields: Record<string, string | number | undefined | null>) {
    const parts: (string | number)[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null) {
        parts.push(k, String(v));
      }
    }
    return client.xadd('trades.intents', '*', ...parts);
  },
  async idempotent(key: string, ttlSec = 300) {
    const ok = await client.set(`copy:intent:idemp:${key}`, '1', 'NX', 'EX', ttlSec);
    return !!ok;
  },
  raw: client,
};


