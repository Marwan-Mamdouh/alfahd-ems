import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REDIS_CLIENT,
  RedisModule,
  buildRedisClient,
  buildRedisConnectionOptions,
} from './redis.module.js';

vi.mock('ioredis', () => {
  const MockRedis = vi.fn();
  return { default: MockRedis, Redis: MockRedis };
});

function configService(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('RedisModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers REDIS_URL over host/port when building the client', () => {
    buildRedisClient(
      configService({
        REDIS_URL: 'redis://user:pass@host:6379',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
      }),
    );
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith('redis://user:pass@host:6379');
  });

  it('falls back to REDIS_HOST/REDIS_PORT when REDIS_URL is not set', () => {
    buildRedisClient(configService({ REDIS_HOST: 'localhost', REDIS_PORT: 6379 }));
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith(6379, 'localhost');
  });

  it('throws when neither REDIS_URL nor REDIS_HOST/PORT is set', () => {
    expect(() => buildRedisClient(configService({}))).toThrow(
      'REDIS_HOST and REDIS_PORT are required when REDIS_URL is not set',
    );
  });

  it('prefers REDIS_URL in BullMQ connection options', () => {
    const options = buildRedisConnectionOptions(
      configService({ REDIS_URL: 'redis://host:6379', REDIS_HOST: 'localhost', REDIS_PORT: 6379 }),
    );
    expect(options).toEqual({ url: 'redis://host:6379', maxRetriesPerRequest: null });
  });

  it('falls back to host/port in BullMQ connection options', () => {
    const options = buildRedisConnectionOptions(
      configService({ REDIS_HOST: 'localhost', REDIS_PORT: 6379 }),
    );
    expect(options).toEqual({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });
  });

  it('wires REDIS_CLIENT through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ REDIS_HOST: 'localhost', REDIS_PORT: 6379 })],
        }),
        RedisModule,
      ],
    }).compile();
    expect(moduleRef.get(REDIS_CLIENT)).toBeDefined();
    expect(Redis).toHaveBeenCalledWith(6379, 'localhost');
  });

  it('pings Redis on startup and quits on shutdown', async () => {
    const client = {
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
    };
    const module = new RedisModule(client as unknown as Redis);
    await module.onModuleInit();
    expect(client.ping).toHaveBeenCalledTimes(1);
    await module.onApplicationShutdown();
    expect(client.quit).toHaveBeenCalledTimes(1);
  });
});
