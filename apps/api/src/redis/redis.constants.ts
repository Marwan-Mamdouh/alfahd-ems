import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'bullmq';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export function buildRedisConnectionOptions(configService: ConfigService): RedisOptions {
  const isTest = configService.get<string>('NODE_ENV') === 'test';
  const url = configService.get<string>('REDIS_URL');
  const base = url
    ? { url }
    : {
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
      };

  return {
    ...base,
    maxRetriesPerRequest: null,
    ...(isTest
      ? {
          enableOfflineQueue: false,
          lazyConnect: true,
          retryStrategy: () => null,
        }
      : {}),
  };
}

export function buildRedisClient(configService: ConfigService): Redis {
  const url = configService.get<string>('REDIS_URL');
  if (url) {
    return new Redis(url);
  }
  const host = configService.get<string>('REDIS_HOST');
  const port = configService.get<number>('REDIS_PORT');
  if (!host || !port) {
    throw new Error('REDIS_HOST and REDIS_PORT are required when REDIS_URL is not set');
  }
  return new Redis(port, host);
}
