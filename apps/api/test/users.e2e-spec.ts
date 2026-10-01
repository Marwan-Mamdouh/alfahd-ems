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

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const CS_ID = '22222222-2222-4222-8222-222222222222';
const TECH_ID = '33333333-3333-4333-8333-333333333333';
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
 * Users e2e with an in-memory database double.
 *
 * Two things are worth asserting here that unit tests cannot cover: the response
 * envelope (every endpoint is wrapped in `data`, including the `{ok: true}` ones
 * — an easy thing to misread from the contract doc), and the RBAC boundary,
 * since the dashboard's client-side RoleGuard is a usability affordance only and
 * this is the actual enforcement.
 */
describe('Users (e2e)', () => {
  let app: INestApplication;
  let rows: FakeUser[];

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
  const technician: FakeUser = {
    id: TECH_ID,
    email: 'tech@fahdgroup.com',
    passwordHash: '',
    role: 'TECHNICIAN',
    isActive: true,
    createdAt: new Date('2026-09-29T10:00:00.000Z'),
    updatedAt: new Date('2026-09-29T10:00:00.000Z'),
  };

  /** Token minting mirrors AuthService: a JWT whose `role` drives RolesGuard. */
  async function tokenFor(user: FakeUser): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return res.body.data.accessToken as string;
  }

  beforeEach(async () => {
    const hash = await argon2.hash(PASSWORD, ARGON2_OPTIONS);
    admin.passwordHash = hash;
    csUser.passwordHash = hash;
    technician.passwordHash = hash;
    rows = [admin, csUser, technician];

    /**
     * Decode a Drizzle `eq(column, value)` clause into a predicate.
     *
     * The services always filter with `eq(users.<column>, <literal>)`, so reading
     * the column name and the bound value out of the SQL node is enough to make
     * the double behave like a real table. Ignoring the clause would make every
     * lookup return the first row, which quietly turns every login into an ADMIN
     * and makes RBAC assertions meaningless.
     */
    const predicateFromClause = (clause: unknown) => {
      const chunks = (clause as { queryChunks?: unknown[] })?.queryChunks ?? [];
      let column: string | undefined;
      let value: unknown;
      for (const chunk of chunks) {
        const candidate = chunk as {
          name?: unknown;
          value?: unknown;
          constructor?: { name?: string };
        };
        if (typeof candidate?.name === 'string' && candidate.constructor?.name === 'PgUUID') {
          column = candidate.name;
        } else if (
          candidate?.constructor?.name === 'PgVarchar' &&
          typeof candidate.name === 'string'
        ) {
          column = candidate.name;
        } else if (candidate?.constructor?.name === 'Param' && 'value' in candidate) {
          value = candidate.value;
        }
      }
      if (!column) return () => true;
      return (row: FakeUser) => row[column as keyof FakeUser] === value;
    };

    const dbStub = {
      select: vi.fn((fields?: Record<string, unknown>) => {
        const project = (row: FakeUser) => {
          if (!fields) return row;
          return Object.fromEntries(
            Object.keys(fields).map((key) => [key, row[key as keyof FakeUser]]),
          );
        };
        const all = () => rows.map(project);
        const filtered = (clause: unknown) => rows.filter(predicateFromClause(clause)).map(project);

        return {
          from: vi.fn(() => ({
            where: vi.fn((clause: unknown) => ({
              limit: vi.fn(async (count?: number) => {
                const found = filtered(clause);
                return count === undefined ? found : found.slice(0, count);
              }),
              // `db.select().from(users)` without a where clause is awaited directly.
              then: async (resolve: (r: unknown[]) => unknown) => resolve(all()),
            })),
            // Supports the await-then-thenable used by UsersService.findAll.
            then: async (resolve: (r: unknown[]) => unknown) => resolve(all()),
          })),
        };
      }),
      insert: vi.fn(() => ({
        values: vi.fn((values: Partial<FakeUser>) => ({
          returning: vi.fn(async () => {
            const created: FakeUser = {
              id: '44444444-4444-4444-8444-444444444444',
              email: values.email ?? 'new@fahdgroup.com',
              passwordHash: values.passwordHash ?? '',
              role: values.role ?? 'TECHNICIAN',
              isActive: true,
              createdAt: new Date('2026-10-01T10:00:00.000Z'),
              updatedAt: new Date('2026-10-01T10:00:00.000Z'),
            };
            rows.push(created);
            return [created];
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: Partial<FakeUser>) => ({
          where: vi.fn((clause: unknown) => {
            const matches = rows.filter(predicateFromClause(clause));
            rows = rows.map((row) => (matches.includes(row) ? { ...row, ...values } : row));
            const updated = matches.map((row) => ({ ...row, ...values }));
            return {
              then: async (resolve: (r: unknown[]) => unknown) => resolve(updated),
              returning: vi.fn(async () => updated),
            };
          }),
        })),
      })),
    };

    const redisStub = {
      set: vi.fn(async () => 'OK'),
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

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('REDIS_CLIENT')
      .useValue(redisStub)
      .overrideProvider(DRIZZLE)
      .useValue(dbStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /users', () => {
    it('returns the full array wrapped in { data } for an ADMIN', async () => {
      const token = await tokenFor(admin);

      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('returns no pagination metadata', async () => {
      // The dashboard derives all three KPIs client-side, so there must be no
      // `meta`/`total` wrapper to unwrap.
      const token = await tokenFor(admin);

      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).not.toHaveProperty('meta');
      expect(res.body).not.toHaveProperty('meta');
    });

    it('emits role "CS" — not "CUSTOMER_SERVICE"', async () => {
      const token = await tokenFor(admin);

      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const cs = res.body.data.find((u: { email: string }) => u.email === csUser.email);
      expect(cs.role).toBe('CS');
    });

    it('returns exactly the canonical UserDto fields', async () => {
      const token = await tokenFor(admin);

      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Object.keys(res.body.data[0]).sort()).toEqual([
        'createdAt',
        'email',
        'id',
        'isActive',
        'role',
      ]);
    });

    it('rejects a non-admin with 403', async () => {
      const token = await tokenFor(csUser);

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects a request with no token with 401', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('rejects a tampered token with 401', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);
    });
  });

  describe('POST /users', () => {
    it('rejects a duplicate email with 409', async () => {
      const token = await tokenFor(admin);

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: csUser.email, password: PASSWORD, role: 'CS' })
        .expect(409);
    });

    it('requires a password of at least 8 characters', async () => {
      const token = await tokenFor(admin);

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@fahdgroup.com', password: 'short', role: 'CS' })
        .expect(400);
    });

    it('rejects an unknown role', async () => {
      const token = await tokenFor(admin);

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@fahdgroup.com', password: PASSWORD, role: 'CUSTOMER_SERVICE' })
        .expect(400);
    });

    it('is ADMIN-only', async () => {
      const token = await tokenFor(technician);

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@fahdgroup.com', password: PASSWORD, role: 'CS' })
        .expect(403);
    });

    it('returns 201 with the new UserDto on success', async () => {
      const token = await tokenFor(admin);

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new.hire@fahdgroup.com', password: PASSWORD, role: 'CS' })
        .expect(201);

      expect(res.body.data.email).toBe('new.hire@fahdgroup.com');
      expect(res.body.data.role).toBe('CS');
    });
  });

  describe('PATCH /users/:id', () => {
    it('prevents an admin deactivating their own account', async () => {
      const token = await tokenFor(admin);

      const res = await request(app.getHttpServer())
        .patch(`/users/${ADMIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(400);

      expect(res.body.message).toBe('Admin cannot deactivate their own account');
    });

    it('deactivates another user (soft-delete, never a hard delete)', async () => {
      const token = await tokenFor(admin);

      await request(app.getHttpServer())
        .patch(`/users/${TECH_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(200);

      const deactivated = rows.find((row) => row.id === TECH_ID);
      expect(deactivated?.isActive).toBe(false);
      // The row still exists — constitution principle IV.
      expect(rows.some((row) => row.id === TECH_ID)).toBe(true);
    });

    it('rejects a duplicate email with 409', async () => {
      const token = await tokenFor(admin);

      await request(app.getHttpServer())
        .patch(`/users/${TECH_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: csUser.email })
        .expect(409);
    });

    it('is ADMIN-only', async () => {
      const token = await tokenFor(csUser);

      await request(app.getHttpServer())
        .patch(`/users/${TECH_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'WAREHOUSE_STAFF' })
        .expect(403);
    });
  });

  describe('POST /users/change-password', () => {
    it('returns { data: { ok: true } } on success for a non-admin', async () => {
      // Any authenticated role may change its own password, not just ADMIN.
      const token = await tokenFor(csUser);

      const res = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: PASSWORD, newPassword: 'brandNewPassword123' })
        // NOTE: 201 is the *actual* behaviour — NestJS defaults POST to 201 and
        // UsersController sets no @HttpCode, unlike every endpoint in
        // AuthController. contracts/api-contracts.md documents 200. Treat this as
        // a known contract/behaviour mismatch: the client must accept either, and
        // the status should be reconciled before the M4 #54 contract freeze.
        .expect(201);

      expect(res.body).toEqual({ data: { ok: true } });
    });

    it('rejects a wrong old password with 400', async () => {
      const token = await tokenFor(csUser);

      const res = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'wrongPassword123', newPassword: 'brandNewPassword123' })
        .expect(400);

      expect(res.body.message).toBe('Old password is incorrect');
    });

    it('requires a token', async () => {
      await request(app.getHttpServer())
        .post('/users/change-password')
        .send({ oldPassword: PASSWORD, newPassword: 'brandNewPassword123' })
        .expect(401);
    });
  });
});
