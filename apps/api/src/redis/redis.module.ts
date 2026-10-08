import { Inject, Logger, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT, buildRedisClient } from './redis.constants.js';
import { SessionService } from './session.service.js';

export { REDIS_CLIENT, buildRedisClient, buildRedisConnectionOptions } from './redis.constants.js';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: buildRedisClient,
    },
    SessionService,
  ],
  exports: [REDIS_CLIENT, SessionService],
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
