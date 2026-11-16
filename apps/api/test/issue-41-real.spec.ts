import { randomUUID } from 'node:crypto';
import { Role } from '@alfahd/types';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/database/schema/index.js';
import { SessionService, sessionKey } from '../src/redis/session.service.js';
import { UsersService } from '../src/users/users.service.js';

const databaseUrl = process.env.ISSUE_41_TEST_DATABASE_URL;
const redisUrl = process.env.ISSUE_41_TEST_REDIS_URL;

// Use a dedicated migrated test database and Redis instance.
describe.skipIf(!databaseUrl || !redisUrl)('issue 41 real-service concurrency', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let redis: Redis;
  let sessions: SessionService;
  let users: UsersService;

  beforeAll(() => {
    pool = new Pool({ connectionString: databaseUrl });
    db = drizzle(pool, { schema });
    redis = new Redis(redisUrl!);
    sessions = new SessionService(redis);
    users = new UsersService(db, {} as never, sessions);
  });

  afterAll(async () => {
    await redis.quit();
    await pool.end();
  });

  it('keeps every concurrently created refresh token revoked or revocable', async () => {
    const userId = randomUUID();
    const tokens = Array.from({ length: 30 }, () => randomUUID());
    try {
      await Promise.all([
        ...tokens.map((token) => sessions.createSession(userId, token)),
        ...tokens.map(() => sessions.revokeAllSessions(userId)),
      ]);
      await sessions.revokeAllSessions(userId);
      expect(await Promise.all(tokens.map((token) => redis.get(sessionKey(token))))).toEqual(
        tokens.map(() => null),
      );
    } finally {
      await sessions.revokeAllSessions(userId);
      await redis.del(...tokens.map((token) => `rv:${token}`));
      await redis.del(`rt:user_generation:${userId}`);
    }
  });

  it('returns each superseded photo exactly once under concurrent replacement', async () => {
    const id = randomUUID();
    await db.insert(schema.users).values({
      id,
      email: `${id}@example.invalid`,
      passwordHash: 'test',
      role: 'CS',
      profilePhotoKey: 'old',
    });
    try {
      const previous = await Promise.all([
        users.updateProfilePhotoKey(id, 'photo-a'),
        users.updateProfilePhotoKey(id, 'photo-b'),
      ]);
      const [current] = await db.select().from(schema.users).where(eq(schema.users.id, id));
      expect(new Set([...previous, current.profilePhotoKey])).toEqual(
        new Set(['old', 'photo-a', 'photo-b']),
      );
      expect(previous).not.toContain(current.profilePhotoKey);
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, id));
    }
  });

  it('never leaves a technician without a warehouse when role and assignment change together', async () => {
    const id = randomUUID();
    const warehouseId = randomUUID();
    await db.insert(schema.warehouses).values({ id: warehouseId, name: 'Issue 41 test' });
    await db.insert(schema.users).values({
      id,
      email: `${id}@example.invalid`,
      passwordHash: 'test',
      role: 'CS',
      assignedWarehouseId: warehouseId,
    });
    try {
      await Promise.allSettled([
        users.update(id, { role: Role.TECHNICIAN }),
        users.updateEmployee(id, { assignedWarehouseId: null as unknown as string }),
      ]);
      const [current] = await db.select().from(schema.users).where(eq(schema.users.id, id));
      expect(current.role !== Role.TECHNICIAN || current.assignedWarehouseId !== null).toBe(true);
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, id));
      await db.delete(schema.warehouses).where(eq(schema.warehouses.id, warehouseId));
    }
  });
});
