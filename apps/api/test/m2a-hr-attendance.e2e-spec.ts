import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import argon2 from 'argon2';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { DRIZZLE } from '../src/database/database.module.js';
import { ARGON2_OPTIONS } from '../src/database/schema/mappers.js';
import { ClockService } from '../src/common/services/clock.service.js';
import { StorageService } from '../src/storage/storage.interface.js';
import { FakeStorageService } from '../src/storage/fake-storage.service.js';
import {
  users,
  warehouses,
  attendanceRecords,
  type User,
  type Warehouse,
  type AttendanceRecord,
} from '../src/database/schema/index.js';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const TECH_ID = '22222222-2222-4222-8222-222222222222';
const WAREHOUSE_ID = '33333333-3333-4333-8333-333333333333';
const PASSWORD = 'securePassword123';

describe('Milestone M2a — HR & Attendance (e2e)', () => {
  let app: INestApplication;
  let usersStore: User[];
  let warehousesStore: Warehouse[];
  let attendanceStore: AttendanceRecord[];
  let redisKeys: Map<string, string>;
  let redisSets: Map<string, Set<string>>;
  let redisZsets: Map<string, Map<string, number>>;
  let fakeStorage: FakeStorageService;
  let adminToken: string;
  let techToken: string;

  const ATT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const adminUser: User = {
    id: ADMIN_ID,
    name: 'Admin User',
    email: 'admin@alfahd.local',
    passwordHash: '',
    role: 'ADMIN',
    department: 'MANAGEMENT',
    phone: '+201000000001',
    nationalId: '29001011234567',
    hireDate: '2025-01-01',
    profilePhotoKey: null,
    status: 'ACTIVE',
    assignedWarehouseId: null,
    isActive: true,
    createdAt: new Date('2026-01-01T08:00:00Z'),
    updatedAt: new Date('2026-01-01T08:00:00Z'),
  };

  const techUser: User = {
    id: TECH_ID,
    name: 'Technician Ali',
    email: 'ali.tech@alfahd.local',
    passwordHash: '',
    role: 'TECHNICIAN',
    department: 'TECHNICAL',
    phone: '+201000000002',
    nationalId: '29201011234567',
    hireDate: '2026-01-01',
    profilePhotoKey: null,
    status: 'ACTIVE',
    assignedWarehouseId: WAREHOUSE_ID,
    isActive: true,
    createdAt: new Date('2026-01-01T08:00:00Z'),
    updatedAt: new Date('2026-01-01T08:00:00Z'),
  };

  const cairoWarehouse: Warehouse = {
    id: WAREHOUSE_ID,
    name: 'Cairo Central Warehouse',
    address: 'Cairo, Egypt',
    gpsLat: 30.0444,
    gpsLng: 31.2357,
    geofenceRadiusMeters: 150,
    managerId: null,
    isActive: true,
    createdAt: new Date('2026-01-01T08:00:00Z'),
    updatedAt: new Date('2026-01-01T08:00:00Z'),
  };

  beforeAll(async () => {
    const passwordHash = await argon2.hash(PASSWORD, ARGON2_OPTIONS);
    adminUser.passwordHash = passwordHash;
    techUser.passwordHash = passwordHash;
  });

  beforeEach(async () => {
    usersStore = [{ ...adminUser }, { ...techUser }];
    warehousesStore = [{ ...cairoWarehouse }];
    attendanceStore = [
      {
        id: ATT_ID,
        userId: TECH_ID,
        workDate: '2026-10-10',
        checkInAt: new Date('2026-10-10T08:30:00Z'),
        checkInLat: 30.0444,
        checkInLng: 31.2357,
        checkInDistanceM: 10,
        checkOutAt: new Date('2026-10-10T16:30:00Z'),
        status: 'LATE',
        overrideReason: null,
        overriddenBy: null,
        overriddenAt: null,
        createdAt: new Date('2026-10-10T08:30:00Z'),
        updatedAt: new Date('2026-10-10T08:30:00Z'),
      },
    ];
    redisKeys = new Map();
    redisSets = new Map();
    redisZsets = new Map();
    fakeStorage = new FakeStorageService();

    const extractConditions = (clause: unknown): Record<string, unknown> => {
      const conditions: Record<string, unknown> = {};
      if (!clause || typeof clause !== 'object') return conditions;

      const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;
        const chunks = node.queryChunks;
        if (Array.isArray(chunks)) {
          let currentColumn: string | undefined;
          for (const chunk of chunks) {
            if (!chunk || typeof chunk !== 'object') continue;
            if (Array.isArray(chunk.queryChunks)) {
              walk(chunk);
            } else if (
              typeof chunk.name === 'string' &&
              chunk.constructor?.name?.startsWith('Pg')
            ) {
              const camel = chunk.name.replace(/_([a-z])/g, (_: string, c: string) =>
                c.toUpperCase(),
              );
              currentColumn = camel;
            } else if (
              (chunk.constructor?.name === 'Param' || 'value' in chunk) &&
              currentColumn &&
              chunk.constructor?.name !== 'StringChunk'
            ) {
              conditions[currentColumn] = chunk.value;
              currentColumn = undefined;
            }
          }
        }
      };

      walk(clause);
      return conditions;
    };

    const matchesRow = (row: any, conditions: Record<string, unknown>): boolean => {
      for (const [key, val] of Object.entries(conditions)) {
        if (val === undefined) continue;
        const rowVal = row[key];
        if (rowVal !== undefined && rowVal !== val) {
          return false;
        }
      }
      return true;
    };

    const redisStub = {
      set: vi.fn(async (key: string, value: string) => {
        redisKeys.set(key, value);
        return 'OK';
      }),
      get: vi.fn(async (key: string) => redisKeys.get(key) ?? null),
      getdel: vi.fn(async () => null),
      exists: vi.fn(async (key: string) => (redisKeys.has(key) ? 1 : 0)),
      smembers: vi.fn(async (key: string) => [...(redisSets.get(key) ?? [])]),
      // ZRANGE 0 -1 over the session index (member ids ordered by expiry score).
      zrange: vi.fn(async (key: string) => {
        const zset = redisZsets.get(key);
        if (!zset) return [];
        return [...zset.entries()].sort((a, b) => a[1] - b[1]).map(([member]) => member);
      }),
      scan: vi.fn(async (_cursor: string, _mode: string, pattern: string) => {
        const matcher = new RegExp(
          `^${pattern
            .split('*')
            .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')}$`,
        );
        const matches = [...redisKeys.keys()].filter((k) => matcher.test(k));
        return ['0', matches];
      }),
      pipeline: vi.fn(() => {
        let zcard = 0;
        const pipeline = {
          del: vi.fn((...keys: string[]) => {
            // Redis DEL removes string, set, and sorted-set keys alike.
            keys.forEach((k) => {
              redisKeys.delete(k);
              redisSets.delete(k);
              redisZsets.delete(k);
            });
            return pipeline;
          }),
          set: vi.fn((key: string, value: string) => {
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
          zcard: vi.fn(() => Promise.resolve([null, zcard])),
          expire: vi.fn(),
          exec: vi.fn(async () => [
            [null, 0],
            [null, 0],
            [null, zcard],
          ]),
        };
        return pipeline;
      }),
      quit: vi.fn(async () => 'OK'),
      ping: vi.fn(async () => 'PONG'),
    };

    const fixedNow = new Date('2026-10-11T05:30:00.000Z'); // 08:30 Cairo DST time (UTC+3)
    const clockStub = {
      now: vi.fn(() => fixedNow),
    };

    const reportsQueueStub = {
      opts: {
        connection: { host: 'localhost', port: 6379 },
      },
      add: vi.fn(async (_name, data) => ({
        id: 'report-attendance-981247',
        data,
      })),
      getJob: vi.fn(async (id: string) => {
        if (id === 'report-attendance-981247') {
          return {
            id,
            data: { requestedBy: ADMIN_ID },
            getState: async () => 'completed',
            returnvalue: {
              downloadUrl: 'https://res.cloudinary.com/alfahd/reports/attendance_20261011.xlsx',
            },
            failedReason: null,
          };
        }
        if (id === 'report-failed-1') {
          return {
            id,
            data: { requestedBy: ADMIN_ID },
            getState: async () => 'failed',
            returnvalue: null,
            // Raw reason carries infra internals that must never reach a client.
            failedReason: 'connect ECONNREFUSED 10.0.3.7:5432 - select * from attendance_records',
          };
        }
        return null;
      }),
    };

    const getTargetStore = (table: any) => {
      if (table === warehouses || table?._?.name === 'warehouses') return warehousesStore;
      if (table === attendanceRecords || table?._?.name === 'attendance_records')
        return attendanceStore;
      if (table === users || table?._?.name === 'users') return usersStore;
      return usersStore;
    };

    const dbStub = {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(async (whereClause?: any) => {
              const conditions = extractConditions(whereClause);
              return attendanceStore
                .filter((att) => matchesRow(att, conditions))
                .map((att) => ({
                  record: att,
                  user: usersStore.find((u) => u.id === att.userId)!,
                }));
            }),
          })),
          where: vi.fn((whereClause: any) => ({
            limit: vi.fn(async (count?: number) => {
              const conditions = extractConditions(whereClause);
              const store = getTargetStore(table);
              const rows = store.filter((item) => matchesRow(item, conditions));
              return count !== undefined ? rows.slice(0, count) : rows;
            }),
            orderBy: vi.fn(() => ({
              limit: vi.fn((limit: number) => ({
                offset: vi.fn(async () => {
                  const conditions = extractConditions(whereClause);
                  return usersStore.filter((u) => matchesRow(u, conditions)).slice(0, limit);
                }),
              })),
            })),
            then: async (resolve: (r: any[]) => void) => {
              const conditions = extractConditions(whereClause);
              if (fields && fields.value) {
                return resolve([
                  { value: usersStore.filter((u) => matchesRow(u, conditions)).length },
                ]);
              }
              const store = getTargetStore(table);
              return resolve(store.filter((item) => matchesRow(item, conditions)));
            },
          })),
          limit: vi.fn(async (count?: number) => {
            const store = getTargetStore(table);
            return count !== undefined ? store.slice(0, count) : store;
          }),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => ({
          returning: vi.fn(async () => {
            const row = {
              id: vals.id ?? `id-${Date.now()}`,
              ...vals,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            if (
              table === attendanceRecords ||
              table?._?.name === 'attendance_records' ||
              vals.workDate
            ) {
              attendanceStore.push(row);
            } else if (table === warehouses || table?._?.name === 'warehouses') {
              warehousesStore.push(row);
            } else {
              usersStore.push(row);
            }
            return [row];
          }),
        })),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn((whereClause: any) => ({
            returning: vi.fn(async () => {
              const conditions = extractConditions(whereClause);
              if (
                table === attendanceRecords ||
                table?._?.name === 'attendance_records' ||
                vals.checkOutAt !== undefined ||
                vals.overrideReason !== undefined
              ) {
                const target =
                  attendanceStore.find((a) => matchesRow(a, conditions)) ??
                  attendanceStore[attendanceStore.length - 1];
                if (target) Object.assign(target, vals);
                return [target];
              }
              const target =
                usersStore.find((u) => matchesRow(u, conditions)) ??
                usersStore[usersStore.length - 1];
              if (target) Object.assign(target, vals);
              return [target];
            }),
          })),
        })),
      })),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('REDIS_CLIENT')
      .useValue(redisStub)
      .overrideProvider(DRIZZLE)
      .useValue(dbStub)
      .overrideProvider(ClockService)
      .useValue(clockStub)
      .overrideProvider(StorageService)
      .useValue(fakeStorage)
      .overrideProvider(getQueueToken('reports'))
      .useValue(reportsQueueStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    // Acquire JWT tokens
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminUser.email, password: PASSWORD })
      .expect(200);
    adminToken = adminLoginRes.body.data.accessToken;

    const techLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: techUser.email, password: PASSWORD })
      .expect(200);
    techToken = techLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('1. Employee Management Flow', () => {
    it('creates an employee with warehouse assignment under ADMIN role (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mostafa Tech',
          email: 'mostafa@alfahd.local',
          role: 'TECHNICIAN',
          department: 'TECHNICAL',
          phone: '+201011112222',
          nationalId: '29801011234567',
          hireDate: '2026-02-01',
          assignedWarehouseId: WAREHOUSE_ID,
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Mostafa Tech');
      expect(res.body.data.role).toBe('TECHNICIAN');
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.assignedWarehouseId).toBe(WAREHOUSE_ID);
    });

    it('rejects technician creation without assignedWarehouseId with 400 TECHNICIAN_REQUIRES_WAREHOUSE', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Tech Without Warehouse',
          email: 'tech.nowh@alfahd.local',
          role: 'TECHNICIAN',
          department: 'TECHNICAL',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('TECHNICIAN_REQUIRES_WAREHOUSE');
    });

    it('returns paginated employees with { data, meta } envelope without double nesting', async () => {
      const res = await request(app.getHttpServer())
        .get('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('page');
      expect(res.body.meta).toHaveProperty('pageSize');
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body).not.toHaveProperty('data.data');
    });

    it('rejects photo upload with invalid magic bytes (400)', async () => {
      const fakePdf = Buffer.from('%PDF-1.5 fake document');
      const res = await request(app.getHttpServer())
        .post(`/employees/${TECH_ID}/photo`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', fakePdf, 'avatar.jpg')
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('ERROR');
    });

    it('successfully uploads JPEG photo and returns publicId and url (201/200)', async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const res = await request(app.getHttpServer())
        .post(`/employees/${TECH_ID}/photo`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', validJpeg, 'photo.jpg')
        .expect(200);

      expect(res.body.data).toHaveProperty('profilePhotoKey');
      expect(res.body.data).toHaveProperty('url');
    });

    it('revokes refresh tokens when status is changed to INACTIVE', async () => {
      // Seed a refresh session in Redis (O(1) layout: token key + user index
      // sorted set, scored by expiry)
      redisKeys.set('rt:token:session-abc', TECH_ID);
      redisZsets.set(
        `rt:user_tokens:${TECH_ID}`,
        new Map([['session-abc', Date.now() + 604800000]]),
      );
      expect(redisKeys.has('rt:token:session-abc')).toBe(true);

      const res = await request(app.getHttpServer())
        .patch(`/employees/${TECH_ID}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'INACTIVE',
          reason: 'Employee resigned on mutual terms',
        })
        .expect(200);

      expect(res.body.data.status).toBe('INACTIVE');
      expect(redisKeys.has('rt:token:session-abc')).toBe(false);
      expect(redisZsets.has(`rt:user_tokens:${TECH_ID}`)).toBe(false);
      // HARD-03: denylist stores the owning userId for replay attribution.
      expect(redisKeys.get('rv:session-abc')).toBe(TECH_ID);
    });

    it('keeps sessions alive when status is set to ON_LEAVE (spec scenario 5)', async () => {
      redisKeys.set('rt:token:session-abc', TECH_ID);
      redisZsets.set(
        `rt:user_tokens:${TECH_ID}`,
        new Map([['session-abc', Date.now() + 604800000]]),
      );

      const res = await request(app.getHttpServer())
        .patch(`/employees/${TECH_ID}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ON_LEAVE', reason: 'Annual leave' })
        .expect(200);

      expect(res.body.data.status).toBe('ON_LEAVE');
      expect(redisKeys.has('rt:token:session-abc')).toBe(true);
      expect(redisZsets.has(`rt:user_tokens:${TECH_ID}`)).toBe(true);
    });

    it('rejects a non-UUID employee id with 400 instead of a 500 DB crash (SEC-06)', async () => {
      const res = await request(app.getHttpServer())
        .get('/employees/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.statusCode).toBe(400);
    });

    it('rejects an employee photo larger than 5 MB with 400 FILE_TOO_LARGE (SEC-03)', async () => {
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff);
      const res = await request(app.getHttpServer())
        .post(`/employees/${TECH_ID}/photo`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', oversized, 'huge.jpg')
        .expect(400);

      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('rejects an unparseable hireDate with 400 instead of a Postgres date error (SEC-07)', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dateless Dave',
          email: 'dave@alfahd.local',
          role: 'CS',
          hireDate: 'not-a-date',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('rejects a phone number longer than varchar(30) with 400 (SEC-07)', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Long Phone',
          email: 'longphone@alfahd.local',
          role: 'CS',
          phone: '+20123456789012345678901234567890',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('rejects a name longer than varchar(255) with 400 on create (HARD-04)', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'N'.repeat(256),
          email: 'longname@alfahd.local',
          role: 'CS',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('rejects a name longer than varchar(255) with 400 on update (HARD-04)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/employees/${TECH_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'N'.repeat(256) })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });
  });

  describe('2. Attendance Geofenced Check-In & Check-Out Flow', () => {
    it('rejects check-in > 150m with 400 OUT_OF_RANGE and returns measured distance', async () => {
      // 0.003 degrees away ≈ 333m
      const farLat = cairoWarehouse.gpsLat! + 0.003;
      const farLng = cairoWarehouse.gpsLng!;

      const res = await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${techToken}`)
        .send({ lat: farLat, lng: farLng })
        .expect(400);

      expect(res.body.error.code).toBe('OUT_OF_RANGE');
      expect(res.body.error.details.distanceM).toBeGreaterThan(150);
      expect(res.body.error.details.allowedRadiusM).toBe(150);
    });

    it('accepts check-in <= 150m and returns ON_TIME (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${techToken}`)
        .send({ lat: cairoWarehouse.gpsLat, lng: cairoWarehouse.gpsLng })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.workDate).toBe('2026-10-11');
      expect(res.body.data.status).toBe('ON_TIME');
      expect(res.body.data.checkInDistanceM).toBeLessThanOrEqual(150);
    });

    it('rejects a second check-in on the same day with 409 ALREADY_CHECKED_IN', async () => {
      // First check-in
      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${techToken}`)
        .send({ lat: cairoWarehouse.gpsLat, lng: cairoWarehouse.gpsLng })
        .expect(201);

      // Second check-in on the same day
      const res = await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${techToken}`)
        .send({ lat: cairoWarehouse.gpsLat, lng: cairoWarehouse.gpsLng })
        .expect(409);

      expect(res.body.error.code).toBe('ALREADY_CHECKED_IN');
    });

    it('successfully checks out without GPS requirement (200)', async () => {
      // Check in first
      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${techToken}`)
        .send({ lat: cairoWarehouse.gpsLat, lng: cairoWarehouse.gpsLng })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/attendance/check-out')
        .set('Authorization', `Bearer ${techToken}`)
        .send({})
        .expect(200);

      expect(res.body.data).toHaveProperty('checkOutAt');
      expect(res.body.data).toHaveProperty('hoursWorked');
    });
  });

  describe('3. Attendance Override & Asynchronous Reports Flow', () => {
    it('rejects attendance override without mandatory reason (400)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/attendance/${ATT_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          overrideReason: '   ',
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('rejects a non-UUID attendance id with 400 instead of a 500 DB crash (SEC-06)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/attendance/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ overrideReason: 'whatever' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('rejects an override whose checkOutAt precedes checkInAt (400, SEC-07)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/attendance/${ATT_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkInAt: '2026-10-10T16:00:00.000Z',
          checkOutAt: '2026-10-10T09:00:00.000Z',
          overrideReason: 'Attempting to reverse time',
        })
        .expect(400);

      expect(res.body.error.code).toBe('CHECK_OUT_BEFORE_CHECK_IN');
    });

    it('overrides attendance record with reason under ADMIN role (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/attendance/${ATT_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ON_TIME',
          overrideReason: 'Gate biometric scanner was down; confirmed by security officer',
        })
        .expect(200);

      expect(res.body.data.overrideReason).toBe(
        'Gate biometric scanner was down; confirmed by security officer',
      );
      expect(res.body.data.overriddenBy).toBe(ADMIN_ID);
    });

    it('enqueues report job and returns 202 with jobId', async () => {
      const res = await request(app.getHttpServer())
        .get('/attendance/report')
        .query({ from: '2026-10-01', to: '2026-10-15' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(202);

      expect(res.body.data).toHaveProperty('jobId');
      expect(res.body.data.jobId).toBe('report-attendance-981247');
    });

    it('queries report job status via GET /jobs/:id (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/jobs/report-attendance-981247')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.id).toBe('report-attendance-981247');
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.downloadUrl).toContain('attendance_20261011.xlsx');
    });

    it('rejects non-admin querying another user job with 404 Not Found', async () => {
      await request(app.getHttpServer())
        .get('/jobs/report-attendance-981247')
        .set('Authorization', `Bearer ${techToken}`)
        .expect(404);
    });

    it('masks the raw failedReason of a failed job (SEC-04)', async () => {
      const res = await request(app.getHttpServer())
        .get('/jobs/report-failed-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('FAILED');
      expect(res.body.data.error).toBe('Report generation failed');
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
      expect(JSON.stringify(res.body)).not.toContain('attendance_records');
    });
  });
});
