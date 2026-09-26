import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthModule } from './auth.module.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RateLimitGuard } from './guards/rate-limit.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { DatabaseModule } from '../database/database.module.js';
import { EmailModule } from '../email/email.module.js';
import { RedisModule } from '../redis/redis.module.js';

vi.mock('ioredis', () => {
  const MockRedis = vi.fn(function MockRedis() {
    return { ping: vi.fn().mockResolvedValue('PONG'), quit: vi.fn().mockResolvedValue('OK') };
  });
  return { default: MockRedis, Redis: MockRedis };
});

const testEnv = {
  DATABASE_URL: 'postgresql://alfahd:alfahd_dev_password@localhost:5432/alfahd_ems',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  EMAIL_PROVIDER: 'smtp',
  EMAIL_FROM: 'noreply@alfahd.local',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  SMTP_USER: 'test',
  SMTP_PASS: 'test',
  FRONTEND_URL: 'http://localhost:3000',
};

describe('M1 module wiring', () => {
  it('compiles AuthModule with guards, strategy, and controller', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [() => ({ ...testEnv })] }),
        DatabaseModule,
        EmailModule,
        RedisModule,
        AuthModule,
      ],
    }).compile();
    expect(moduleRef.get(AuthService)).toBeDefined();
    expect(moduleRef.get(AuthController)).toBeDefined();
    expect(moduleRef.get(JwtStrategy)).toBeDefined();
    expect(moduleRef.get(JwtAuthGuard)).toBeDefined();
    expect(moduleRef.get(RateLimitGuard)).toBeDefined();
    await moduleRef.close();
  });
});
