import IORedis, { type RedisOptions } from 'ioredis';

export const createRedisClient = (options: RedisOptions) => {
  const client = new IORedis(options);
  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Redis error', err.message);
  });
  return client;
};

export type RedisClient = ReturnType<typeof createRedisClient>;


