import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import argon2 from 'argon2';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor.js';
import { RateLimitGuard } from './../src/auth/guards/rate-limit.guard.js';
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
  let redisSets: Map<string, Set<string>>;

  it('does not rate-limit repeated successful logins', async () => {
    for (let i = 0; i < 6; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(200);
    }
  });

  it('limits failed credentials, does not extend blocked retries, and recovers', async () => {
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      for (let i = 0; i < 60; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: admin.email, password: 'wrong-password' })
          .expect(401);
      }
      // From here on, recordFailure must stay silent: a blocked request never
      // reaches the controller, and asserted outcomes (Retry-After decay 600 →
      // 570, recovery) would hold even under a record-before-check regression,
      // so the spy is what actually pins "blocked retries add nothing".
      const guard = app.get(RateLimitGuard);
      const recordFailure = vi.spyOn(guard, 'recordFailure');
      const blocked = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(429);
      expect(blocked.headers['retry-after']).toBe('600');
      now += 30_000;
      const retry = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(429);
      expect(retry.headers['retry-after']).toBe('570');
      now += 570_000;
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(200);
      // One final success (and the two 429s above) must never have recorded.
      expect(recordFailure).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  }, 30000);

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
    redisSets = new Map();

    // Minimal Redis double covering only what SessionService and RateLimitGuard
    // call: set/get/exists/zrange + a pipeline with zadd/zrem/zremrangebyscore
    // (the rt:user_tokens:{userId} session index is a sorted set scored by
    // expiry). SessionService is O(1) per op — no SCAN is ever issued.
    const redisZsets = new Map<string, Map<string, number>>();
    const redisStub = {
      eval: vi.fn(
        async (
          _script: string,
          _keys: number,
          key: string,
          now: number,
          window: number,
          max: number,
        ) => {
          const zset = redisZsets.get(key);
          if (!zset) return 0;
          for (const [member, score] of zset) {
            if (score <= now - window) zset.delete(member);
          }
          if (zset.size < max) return 0;
          const expiryScore = [...zset.values()].sort((a, b) => a - b)[zset.size - max];
          return Math.max(1, Math.ceil((expiryScore + window - now) / 1000));
        },
      ),
      set: vi.fn(async (key: string, value: string, _mode: string, _ttl?: number) => {
        redisKeys.set(key, value);
        redisSetArgs.set(key, value);
        return 'OK';
      }),
      get: vi.fn(async (key: string) => redisKeys.get(key) ?? null),
      getdel: vi.fn(async (key: string) => {
        const value = redisKeys.get(key) ?? null;
        redisKeys.delete(key);
        return value;
      }),
      exists: vi.fn(async (key: string) => (redisKeys.has(key) ? 1 : 0)),
      smembers: vi.fn(async (key: string) => [...(redisSets.get(key) ?? [])]),
      // ZRANGE 0 -1 over the session index (member ids ordered by expiry score).
      zrange: vi.fn(async (key: string) => {
        const zset = redisZsets.get(key);
        if (!zset) return [];
        return [...zset.entries()].sort((a, b) => a[1] - b[1]).map(([member]) => member);
      }),
      scan: vi.fn(async () => ['0', []] as [string, string[]]),
      pipeline: vi.fn(() => {
        let zcard = 0;
        const pipeline = {
          // Must actually mutate the key store: logout revokes a session and
          // relies on `del` taking effect for the subsequent refresh to 401.
          del: vi.fn((...keys: string[]) => {
            keys.forEach((key) => {
              redisKeys.delete(key);
              redisSets.delete(key);
              redisZsets.delete(key);
            });
            return pipeline;
          }),
          set: vi.fn((key: string, value: string, _mode: string, _ttl?: number) => {
            redisKeys.set(key, value);
            return pipeline;
          }),
          sadd: vi.fn((key: string, member: string) => {
            if (!redisSets.has(key)) redisSets.set(key, new Set());
            redisSets.get(key)!.add(member);
            return pipeline;
          }),
          srem: vi.fn((key: string, member: string) => {
            redisSets.get(key)?.delete(member);
            return pipeline;
          }),
          // Session indexing (createSession) AND the rate-limit guard both use
          // these — chained calls must return the pipeline.
          zadd: vi.fn((key: string, score: number, member: string) => {
            zcard += 1;
            if (!redisZsets.has(key)) redisZsets.set(key, new Map());
            redisZsets.get(key)!.set(member, score);
            return pipeline;
          }),
          zrem: vi.fn((key: string, member: string) => {
            redisZsets.get(key)?.delete(member);
            return pipeline;
          }),
          zremrangebyscore: vi.fn((key: string, min: number, max: number) => {
            const zset = redisZsets.get(key);
            if (zset) {
              for (const [member, score] of [...zset]) {
                if (score >= Number(min) && score <= Number(max)) zset.delete(member);
              }
            }
            return pipeline;
          }),
          zcard: vi.fn((key: string) => {
            zcard = redisZsets.get(key)?.size ?? 0;
            return pipeline;
          }),
          expire: vi.fn(() => pipeline),
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
    it('sets an HTTP-only refresh cookie scoped to the whole origin', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(200);

      const cookies = res.headers['set-cookie'] as unknown as string[];
      const cookie = cookies?.find((c) => c.startsWith('refresh_token='));

      expect(cookie).toBeDefined();
      // HTTP-only is the entire point: JS must not be able to read the token.
      expect(cookie).toMatch(/HttpOnly/i);
      // Path=/ is required for the web client: per RFC 6265 a cookie is sent only
      // on request paths it prefixes, and the browser reaches the refresh route at
      // `/api/auth/refresh` (Next.js rewrite) while the proxy guard reads the
      // cookie on `/dashboard`. `/auth` reaches neither.
      expect(cookie).toMatch(/Path=\/(;|$)/i);
      expect(cookie).not.toMatch(/Path=\/auth/i);
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

    it('rejects a deactivated user with 403 Forbidden without setting a cookie', async () => {
      admin.isActive = false;

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(403);

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

    it('rotates refresh token on use: sets new cookie, returns new token in body, and invalidates old token (web flow)', async () => {
      const { cookie: cookie1 } = await login();
      const oldTokenId = cookie1.split('=')[1];

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie1)
        .send({})
        .expect(200);

      const cookie2 = refreshCookieFrom(res);
      const newTokenId = cookie2.split('=')[1];

      expect(cookie2).not.toBe(cookie1);
      expect(newTokenId).not.toBe(oldTokenId);
      expect(res.body.data.refreshToken).toBe(newTokenId);
      expect(typeof res.body.data.accessToken).toBe('string');

      const cookies = res.headers['set-cookie'] as unknown as string[];
      const setCookie = cookies?.find((c) => c.startsWith('refresh_token='));
      expect(setCookie).toBeDefined();
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/Path=\/(;|$)/i);

      // Replaying cookie1 again -> 401 (rotation: single-use)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie1)
        .send({})
        .expect(401);

      // Refreshing with cookie2 (the rotated cookie) -> 200
      const res2 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie2)
        .send({})
        .expect(200);

      expect(res2.body.data.accessToken).toBeDefined();
    });

    it('rotates refresh token via body and rejects replaying original token (mobile flow)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: admin.email, password: PASSWORD })
        .expect(200);

      const tokenId = loginRes.body.data.refreshToken;
      expect(tokenId).toBeDefined();

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tokenId })
        .expect(200);

      const rotatedToken = refreshRes.body.data.refreshToken;
      expect(rotatedToken).toBeDefined();
      expect(rotatedToken).not.toBe(tokenId);
      expect(typeof refreshRes.body.data.accessToken).toBe('string');

      // Replaying the original body token -> 401
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tokenId })
        .expect(401);

      // Using the rotated token -> 200
      const refreshRes2 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: rotatedToken })
        .expect(200);

      expect(refreshRes2.body.data.accessToken).toBeDefined();
    });

    it('rejects a request with neither cookie nor body token', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').send({}).expect(401);
    });

    it('rejects an unknown token id and clears cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=not-a-real-token')
        .send({})
        .expect(401);

      const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
      const cleared = cookies?.find((c) => c.startsWith('refresh_token='));
      expect(cleared).toBeDefined();
    });

    it('does not clear cookie on replay of rotated refresh token (retains winning cookie for other tabs)', async () => {
      const { cookie: cookie1 } = await login();

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie1)
        .send({})
        .expect(200);

      const cookie2 = refreshCookieFrom(refreshRes);

      // Replay of cookie1 (e.g. losing concurrent tab) -> 401
      const replayRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie1)
        .send({})
        .expect(401);

      // Must NOT clear the cookie: winning tab's cookie must survive
      const replayCookies = replayRes.headers['set-cookie'] as unknown as string[] | undefined;
      const clearedCookie = replayCookies?.find((c) => c.startsWith('refresh_token='));
      expect(clearedCookie).toBeUndefined();

      // Subsequent refresh with cookie2 (the winning cookie) -> 200
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie2)
        .send({})
        .expect(200);
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
      expect(cleared).toMatch(/Path=\/(;|$)/i);
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

    it('invalidates rotated sessions even when called with a pre-rotation access token (account-wide logout)', async () => {
      const { accessToken: access1, cookie: cookie1 } = await login();

      // Refresh rotates the session and issues cookie2
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie1)
        .send({})
        .expect(200);

      const cookie2 = refreshCookieFrom(refreshRes);

      // Logout with access1 (carrying stale pre-rotation jti) -> 200
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${access1}`)
        .expect(200);

      // Subsequent refresh with cookie2 must return 401
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie2)
        .send({})
        .expect(401);
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
