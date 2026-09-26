import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'bullmq';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export function buildRedisConnectionOptions(configService: ConfigService): RedisOptions {
  const url = configService.get<string>('REDIS_URL');
  if (url) {
    return { url, maxRetriesPerRequest: null };
  }
  return {
    host: configService.get<string>('REDIS_HOST'),
    port: configService.get<number>('REDIS_PORT'),
    maxRetriesPerRequest: null,
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
