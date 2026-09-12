import { describe, it, expect } from 'vitest';
import { envSchema } from '../../src/config/env.validation.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  EMAIL_PROVIDER: 'smtp',
  EMAIL_FROM: 'test@example.com',
};

describe('envSchema validation', () => {
  it('parses valid env with REDIS_HOST/PORT', () => {
    const result = envSchema.parse(validEnv);
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.REDIS_HOST).toBe('localhost');
    expect(result.REDIS_PORT).toBe(6379);
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
  });

  it('parses valid env with REDIS_URL', () => {
    const result = envSchema.parse({
      ...validEnv,
      REDIS_URL: 'redis://localhost:6379',
      REDIS_HOST: undefined,
      REDIS_PORT: undefined,
    });
    expect(result.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('throws on missing DATABASE_URL', () => {
    expect(() => envSchema.parse({ ...validEnv, DATABASE_URL: undefined })).toThrow();
  });

  it('throws on missing JWT_ACCESS_SECRET', () => {
    expect(() => envSchema.parse({ ...validEnv, JWT_ACCESS_SECRET: undefined })).toThrow();
  });

  it('throws on short JWT_ACCESS_SECRET', () => {
    expect(() => envSchema.parse({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });

  it('throws on invalid EMAIL_FROM', () => {
    expect(() => envSchema.parse({ ...validEnv, EMAIL_FROM: 'not-an-email' })).toThrow();
  });

  it('throws on invalid EMAIL_PROVIDER', () => {
    expect(() => envSchema.parse({ ...validEnv, EMAIL_PROVIDER: 'invalid' })).toThrow();
  });

  it('throws when neither REDIS_URL nor REDIS_HOST/PORT provided', () => {
    expect(() =>
      envSchema.parse({
        ...validEnv,
        REDIS_URL: undefined,
        REDIS_HOST: undefined,
        REDIS_PORT: undefined,
      }),
    ).toThrow('Either REDIS_URL or both REDIS_HOST and REDIS_PORT are required');
  });

  it('throws on invalid DATABASE_URL', () => {
    expect(() => envSchema.parse({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('throws on invalid REDIS_URL', () => {
    expect(() =>
      envSchema.parse({
        ...validEnv,
        REDIS_URL: 'not-a-url',
        REDIS_HOST: undefined,
        REDIS_PORT: undefined,
      }),
    ).toThrow();
  });

  it('coerces PORT to number', () => {
    const result = envSchema.parse({ ...validEnv, PORT: '4000' });
    expect(result.PORT).toBe(4000);
  });

  it('defaults JWT_EXPIRES_IN values', () => {
    const result = envSchema.parse(validEnv);
    expect(result.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(result.JWT_REFRESH_EXPIRES_IN).toBe('7d');
  });
});
