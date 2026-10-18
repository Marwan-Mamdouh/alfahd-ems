import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { vi } from 'vitest';
import { Role } from '@alfahd/types';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import type { AccessTokenPayload } from '../src/auth/auth.service.js';

export function createRedisStub() {
  return {
    set: vi.fn(async () => 'OK'),
    get: vi.fn(async () => null),
    del: vi.fn(async () => 1),
    getdel: vi.fn(async () => null),
    exists: vi.fn(async () => 0),
    scan: vi.fn(async () => ['0', []]),
    pipeline: vi.fn(() => {
      let count = 0;
      const pipeline = {
        del: vi.fn(() => pipeline),
        set: vi.fn(() => pipeline),
        zremrangebyscore: vi.fn(() => pipeline),
        zadd: vi.fn(() => {
          count += 1;
          return pipeline;
        }),
        zcard: vi.fn(() => pipeline),
        expire: vi.fn(() => pipeline),
        exec: vi.fn(async () => [
          [null, 0],
          [null, 0],
          [null, count],
        ]),
      };
      return pipeline;
    }),
    quit: vi.fn(async () => 'OK'),
    ping: vi.fn(async () => 'PONG'),
  };
}

export interface SetupTestAppOptions {
  overrideProviders?: Array<{
    provide: unknown;
    useValue: unknown;
  }>;
}

export async function setupTestApp(options: SetupTestAppOptions = {}): Promise<{
  app: INestApplication;
  moduleFixture: TestingModule;
}> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });

  const hasRedisOverride = options.overrideProviders?.some(
    (p) => p.provide === 'REDIS_CLIENT',
  );

  if (!hasRedisOverride) {
    builder = builder.overrideProvider('REDIS_CLIENT').useValue(createRedisStub());
  }

  for (const override of options.overrideProviders ?? []) {
    builder = builder.overrideProvider(override.provide).useValue(override.useValue);
  }

  const moduleFixture = await builder.compile();
  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();

  return { app, moduleFixture };
}

export function createAuthToken(
  jwtService: JwtService,
  options: {
    role: Role;
    userId?: string;
    email?: string;
    tokenId?: string;
  },
): string {
  const payload: AccessTokenPayload = {
    sub: options.userId ?? '11111111-1111-4111-8111-111111111111',
    email: options.email ?? `user-${options.role.toLowerCase()}@fahdgroup.com`,
    role: options.role,
    jti: options.tokenId ?? 'test-token-id',
  };
  return jwtService.sign(payload);
}

export function getAuthHeader(
  jwtService: JwtService,
  role: Role,
  userId?: string,
  email?: string,
): { Authorization: string } {
  const token = createAuthToken(jwtService, { role, userId, email });
  return { Authorization: `Bearer ${token}` };
}

export async function loginAndGetToken(
  app: INestApplication,
  email: string,
  pass: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: pass })
    .expect(200);

  return (res.body?.data?.accessToken || res.body?.accessToken || res.body?.token) as string;
}

export async function loginAndGetCookies(
  app: INestApplication,
  email: string,
  pass: string,
): Promise<string[]> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: pass })
    .expect(200);

  return res.headers['set-cookie'] as unknown as string[];
}

export async function loginAndGetAuthHeader(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ Authorization: string }> {
  const token = await loginAndGetToken(app, email, password);
  return { Authorization: `Bearer ${token}` };
}
