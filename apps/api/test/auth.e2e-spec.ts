import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import argon2 from 'argon2';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor.js';
import { DRIZZLE } from './../src/database/database.module.js';
import { ARGON2_OPTIONS } from './../src/database/schema/mappers.js';
import { corsOrigins } from './../src/config/refresh-cookie.js';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const CS_ID = '22222222-2222-4222-8222-222222222222';
const PASSWORD = 'securePassword123';

interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'WAREHOUSE_STAFF' | 'CS' | 'TECHNICIAN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Auth e2e over the real HTTP stack, with Redis and Postgres replaced by stubs.
 *
 * The focus is the refresh-cookie contract added by feature 004: that login sets
 * an HTTP-only cookie, that refresh accepts cookie-first with a body fallback,
 * and that logout clears it. Those paths cannot be verified with unit tests
 * because they depend on middleware and interceptor wiring that only exists in a
 * booted Nest application.
 */
describe('Auth (e2e) — refresh cookie transport', () => {
  let app: INestApplication;
  let users: FakeUser[];
  let redisKeys: Map<string, string>;
  let redisSetArgs: Map<string, string>;

  const admin: FakeUser = {
    id: ADMIN_ID,
    email: 'admin@fahdgroup.com',
    passwordHash: '',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date('2026-09-27T10:00:00.000Z'),
    updatedAt: new Date('2026-09-27T10:00:00.000Z'),
  };

  const csUser: FakeUser = {
    id: CS_ID,
    email: 'cs@fahdgroup.com',
    passwordHash: '',
    role: 'CS',
    isActive: true,
    createdAt: new Date('2026-09-28T10:00:00.000Z'),
    updatedAt: new Date('2026-09-28T10:00:00.000Z'),
  };

  beforeAll(async () => {
    const passwordHash = await argon2.hash(PASSWORD, ARGON2_OPTIONS);
    admin.passwordHash = passwordHash;
    csUser.passwordHash = passwordHash;
  });

  beforeEach(async () => {
    users = [admin, csUser];
    redisKeys = new Map();
    redisSetArgs = new Map();

    // Minimal Redis double covering only what SessionService and RateLimitGuard
    // call: set/scan/exists/pipeline.
    const redisStub = {
      set: vi.fn(async (key: string, value: string, _mode: string, _ttl?: number) => {
        redisKeys.set(key, value);
        redisSetArgs.set(key, value);
        return 'OK';
      }),
      getdel: vi.fn(async () => null),
      exists: vi.fn(async (key: string) => (redisKeys.has(key) ? 1 : 0)),
      // SessionService scans with patterns like `rt:*:{tokenId}` and
      // `rt:{userId}:*`, so convert the glob to a matcher instead of naively
      // stripping the `*` (which would turn `rt:*:abc` into `rt::abc` and match
      // nothing, making every refresh look like an unknown token).
      scan: vi.fn(async (_cursor: string, _mode: string, pattern: string) => {
        const matcher = new RegExp(
          `^${pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')}$`,
        );
        const matches = [...redisKeys.keys()].filter((key) => matcher.test(key));
        return ['0', matches];
      }),
      pipeline: vi.fn(() => {
        let zcard = 0;
        const pipeline = {
          // Must actually mutate the key store: logout revokes a session and
          // relies on `del` taking effect for the subsequent refresh to 401.
          del: vi.fn((...keys: string[]) => {
            keys.forEach((key) => redisKeys.delete(key));
            return pipeline;
          }),
          set: vi.fn((key: string, value: string, _mode: string, _ttl?: number) => {
            redisKeys.set(key, value);
            return pipeline;
          }),
          zremrangebyscore: vi.fn(),
          zadd: vi.fn(() => {
            zcard += 1;
            return pipeline;
          }),
          zcard: vi.fn(() => {
            // Rate-limit guard reads results[2] for the count.
            return Promise.resolve([null, zcard]);
          }),
          expire: vi.fn(),
          exec: vi.fn(async () => {
            return [
              [null, 0],
              [null, 0],
              [null, zcard],
            ];
          }),
        };
        return pipeline;
      }),
      quit: vi.fn(async () => 'OK'),
      ping: vi.fn(async () => 'PONG'),
    };

    // Drizzle double: the services only ever call
    // db.select().from(users).where(...).limit(1) / without .limit().
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          // Must read the live fixture: tests that deactivate an account mutate
          // `users`, and refresh must then reject.
          where: vi.fn(() => ({
            limit: vi.fn(async (count?: number) =>
              count === undefined ? users : users.slice(0, count),
            ),
            then: async (resolve: (rows: FakeUser[]) => unknown) => resolve(users),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
          returning: vi.fn(async () => []),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('REDIS_CLIENT')
      .useValue(redisStub)
      .overrideProvider(DRIZZLE)
      .useValue(dbStub)
      .compile();

    app = moduleFixture.createNestApplication();

    // main.ts performs these at bootstrap; the test harness bypasses it, so they
    // must be replicated here or the cookie is never set/parsed.
    app.use(cookieParser());
    app.enableCors({
      origin: corsOrigins({
        CORS_ORIGINS: 'https://dashboard.vercel.app,http://localhost:3000',
        FRONTEND_URL: 'http://localhost:3000',
      }),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function refreshCookieFrom(res: request.Response): string {
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cookie = cookies?.find((c) => c.startsWith('refresh_token='));
    if (!cookie) throw new Error('no refresh_token cookie set');
    return cookie.split(';')[0];
  }

  async function login(email = admin.email): Promise<{ accessToken: string; cookie: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      accessToken: res.body.data.accessToken,
      cookie: refreshCookieFrom(res),
    };
  }

  describe('POST /auth/login', () => {
    it('sets an HTTP-only refresh cookie scoped to /auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(200);

      const cookies = res.headers['set-cookie'] as unknown as string[];
      const cookie = cookies?.find((c) => c.startsWith('refresh_token='));

      expect(cookie).toBeDefined();
      // HTTP-only is the entire point: JS must not be able to read the token.
      expect(cookie).toMatch(/HttpOnly/i);
      // Scoping to /auth keeps a long-lived credential off GET /users etc.
      expect(cookie).toMatch(/Path=\/auth/i);
      // Never SameSite=Strict — incompatible with the cross-origin deploy.
      expect(cookie).not.toMatch(/SameSite=Strict/i);
    });

    it('wraps the response in { data } and returns the canonical UserDto', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data.user).toEqual({
        id: ADMIN_ID,
        email: admin.email,
        role: 'ADMIN',
        isActive: true,
        createdAt: '2026-09-27T10:00:00.000Z',
      });
      // UserDto has no name/department fields — the UI must not expect them.
      expect(res.body.data.user).not.toHaveProperty('name');
    });

    it('sets no cookie for invalid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: 'wrongPassword123' })
        .expect(401);

      expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('rejects a deactivated user without setting a cookie', async () => {
      admin.isActive = false;

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(401);

      expect(res.headers['set-cookie']).toBeUndefined();
      admin.isActive = true;
    });
  });

  describe('POST /auth/refresh', () => {
    it('accepts the cookie alone with an empty body (web flow)', async () => {
      // The regression this guards: requiring a body refresh token would 401 every
      // page reload, because the web client cannot read the cookie to send it back.
      const { cookie } = await login();

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .send({})
        .expect(200);

      expect(typeof res.body.data.accessToken).toBe('string');
    });

    it('does NOT return a refreshToken in the body', async () => {
      // The old frontend interceptor read this field and wrote it into the store,
      // overwriting a valid token with undefined and forcing a logout.
      const { cookie } = await login();

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .send({})
        .expect(200);

      expect(res.body.data).not.toHaveProperty('refreshToken');
    });

    it('does not rotate the refresh token', async () => {
      const { cookie } = await login();
      const tokenId = cookie.split('=')[1];

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .send({})
        .expect(200);
      // Same token id must still work: rotation is deferred (FR-004).
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .send({})
        .expect(200);

      expect(res.body.data).toBeTruthy();
      expect(cookie.split('=')[1]).toBe(tokenId);
    });

    it('still accepts a body token for mobile clients', async () => {
      const { accessToken, cookie } = await login();
      const tokenId = cookie.split('=')[1];

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tokenId })
        .expect(200);

      expect(typeof res.body.data.accessToken).toBe('string');
      expect(accessToken).toBeTruthy();
    });

    it('rejects a request with neither cookie nor body token', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').send({}).expect(401);
    });

    it('rejects an unknown token id', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=not-a-real-token')
        .send({})
        .expect(401);
    });

    it('rejects a revoked token (logout invalidates the session)', async () => {
      const { accessToken, cookie } = await login();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .send({})
        .expect(401);
    });

    it('rejects refresh for a user deactivated after login', async () => {
      const { cookie } = await login();
      admin.isActive = false;

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .send({})
        .expect(401);
      admin.isActive = true;
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie using the same path it was set with', async () => {
      // A mismatched path leaves the cookie in the browser and the session
      // appears to survive logout.
      const { accessToken } = await login();

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const cookies = res.headers['set-cookie'] as unknown as string[];
      const cleared = cookies?.find((c) => c.startsWith('refresh_token='));

      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Path=\/auth/i);
      // Express expresses clearCookie as an empty value plus a past Expires date,
      // so accept either that or an explicit Max-Age=0.
      expect(cleared).toMatch(/refresh_token=;/);
      expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    });

    it('returns { data: { ok: true } } — the envelope wraps every endpoint', async () => {
      const { accessToken } = await login();

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual({ data: { ok: true } });
    });

    it('requires a bearer token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });

  describe('CORS (credentialed)', () => {
    it('allows an allowlisted origin and permits credentials', () => {
      return request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'https://dashboard.vercel.app')
        .set('Access-Control-Request-Method', 'POST')
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBe('https://dashboard.vercel.app');
          expect(res.headers['access-control-allow-credentials']).toBe('true');
        });
    });

    it('allows the local dev origin', () => {
      return request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
          expect(res.headers['access-control-allow-credentials']).toBe('true');
        });
    });

    it('does not echo a disallowed origin', () => {
      // Guards against a future '*' regression: browsers reject a wildcard with
      // credentials, which would break the refresh cookie in production while
      // every functional test still passed.
      return request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'https://evil.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    });

    it('never returns a wildcard origin', () => {
      return request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'https://evil.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).not.toBe('*');
        });
    });
  });
});
