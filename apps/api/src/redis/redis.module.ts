import { Inject, Logger, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
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

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: buildRedisClient,
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleInit(): Promise<void> {
    await this.redis.ping();
    this.logger.log('Redis connected (PING=PONG)');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
