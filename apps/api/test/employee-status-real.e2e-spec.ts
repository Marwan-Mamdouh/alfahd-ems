import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { hash } from 'argon2';
import { eq, inArray } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { DRIZZLE, type Db } from '../src/database/database.module.js';
import { employeeStatusHistory, users } from '../src/database/schema/index.js';
import { ARGON2_OPTIONS } from '../src/database/schema/mappers.js';
import { REDIS_CLIENT } from '../src/redis/redis.constants.js';
import { sessionKey, SessionService } from '../src/redis/session.service.js';
import { UsersService } from '../src/users/users.service.js';

// Requires a dedicated, migrated test database and Redis; never runs by default.
describe.skipIf(process.env.RUN_REAL_STATUS_TESTS !== '1')(
  'employee status with real services',
  () => {
    let app: INestApplication;
    let db: Db;
    let sessions: SessionService;
    let usersService: UsersService;
    let redis: Redis;
    let token: string;
    const adminId = randomUUID();
    const employeeId = randomUUID();
    const sessionId = randomUUID();
    const password = 'test-password-123';

    beforeAll(async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(getQueueToken('reports'))
        .useValue({ add: async () => ({}), getJob: async () => null })
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      app.useGlobalInterceptors(new ResponseInterceptor());
      await app.init();
      db = module.get(DRIZZLE);
      sessions = module.get(SessionService);
      redis = module.get(REDIS_CLIENT);
      usersService = module.get(UsersService);
      const passwordHash = await hash(password, ARGON2_OPTIONS);
      await db.insert(users).values([
        { id: adminId, email: `${adminId}@example.test`, passwordHash, role: 'ADMIN' },
        { id: employeeId, email: `${employeeId}@example.test`, passwordHash, role: 'CS' },
      ]);
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `${adminId}@example.test`, password })
        .expect(200);
      token = login.body.data.accessToken;
    }, 30000);

    afterAll(async () => {
      if (db) {
        await db
          .delete(employeeStatusHistory)
          .where(eq(employeeStatusHistory.employeeId, employeeId));
        await db.delete(users).where(inArray(users.id, [adminId, employeeId]));
      }
      if (sessions) {
        await sessions.revokeAllSessions(adminId);
        await sessions.revokeAllSessions(employeeId);
      }
      if (app) await app.close();
    });

    it('records actor, reasons and status history, and revokes only on INACTIVE', async () => {
      await sessions.createSession(employeeId, sessionId);
      for (const reason of [undefined, '', '   ']) {
        await request(app.getHttpServer())
          .patch(`/employees/${employeeId}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'ON_LEAVE', reason })
          .expect(400);
      }
      await request(app.getHttpServer())
        .patch(`/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ON_LEAVE', reason: 'Annual leave' })
        .expect(200);
      expect(await sessions.isRevoked(sessionId)).toBe(false);
      expect(await redis.get(sessionKey(sessionId))).toBe(employeeId);
      await request(app.getHttpServer())
        .patch(`/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ACTIVE', reason: 'Returned' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INACTIVE', reason: 'Left company' })
        .expect(200);
      expect(await sessions.isRevoked(sessionId)).toBe(true);
      expect(await redis.get(sessionKey(sessionId))).toBeNull();
      const history = await db
        .select()
        .from(employeeStatusHistory)
        .where(eq(employeeStatusHistory.employeeId, employeeId))
        .orderBy(employeeStatusHistory.createdAt);
      expect(
        history.map(({ actorId, previousStatus, status, reason }) => ({
          actorId,
          previousStatus,
          status,
          reason,
        })),
      ).toEqual([
        { actorId: adminId, previousStatus: 'ACTIVE', status: 'ON_LEAVE', reason: 'Annual leave' },
        { actorId: adminId, previousStatus: 'ON_LEAVE', status: 'ACTIVE', reason: 'Returned' },
        { actorId: adminId, previousStatus: 'ACTIVE', status: 'INACTIVE', reason: 'Left company' },
      ]);
      expect(history.every((entry) => entry.createdAt instanceof Date)).toBe(true);
    });

    it('rolls back a status update if its audit record cannot be inserted', async () => {
      const [before] = await db.select().from(users).where(eq(users.id, employeeId));
      await expect(
        usersService.updateEmployeeStatus(employeeId, 'ACTIVE', 'Invalid actor', randomUUID()),
      ).rejects.toThrow();
      const [after] = await db.select().from(users).where(eq(users.id, employeeId));
      expect(after.status).toBe(before.status);
      expect(after.isActive).toBe(before.isActive);
    });
  },
);
