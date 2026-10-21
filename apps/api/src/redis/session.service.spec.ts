import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_RESET_TTL_SECONDS,
  REFRESH_SESSION_TTL_SECONDS,
  REVOKED_TOKEN_TTL_SECONDS,
  SessionService,
  sessionKey,
  userTokensKey,
} from './session.service.js';

function createFakeRedis() {
  const store = new Map<string, string>();
  // Sorted Set double: key → (member → score = expiry epoch ms).
  const zsets = new Map<string, Map<string, number>>();
  const redis = {
    set: vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    // Real Redis DEL removes keys of any type, including sorted sets.
    del: vi.fn(async (key: string) => {
      const hadString = store.delete(key);
      const hadZset = zsets.delete(key);
      return hadString || hadZset ? 1 : 0;
    }),
    getdel: vi.fn(async (key: string) => {
      const value = store.get(key) ?? null;
      store.delete(key);
      return value;
    }),
    zrange: vi.fn(async (key: string, _min: number, _max: number) => {
      const zset = zsets.get(key);
      if (!zset) return [];
      // ZRANGE 0 -1 = every member ordered by ascending score.
      return [...zset.entries()].sort((a, b) => a[1] - b[1]).map(([member]) => member);
    }),
    // The O(1) design must never fall back to a keyspace SCAN.
    scan: vi.fn(async () => ['0', []] as [string, string[]]),
    pipeline() {
      const ops: Array<() => Promise<unknown>> = [];
      const pipe = {
        del: (key: string) => {
          ops.push(() => redis.del(key));
          return pipe;
        },
        set: (key: string, value: string, ...args: unknown[]) => {
          ops.push(() => redis.set(key, value, ...args));
          return pipe;
        },
        zadd: (key: string, score: number, member: string) => {
          ops.push(async () => {
            if (!zsets.has(key)) zsets.set(key, new Map());
            zsets.get(key)!.set(member, score);
            return 1;
          });
          return pipe;
        },
        zrem: (key: string, member: string) => {
          ops.push(async () => (zsets.get(key)?.delete(member) ? 1 : 0));
          return pipe;
        },
        zremrangebyscore: (key: string, min: number, max: number) => {
          ops.push(async () => {
            const zset = zsets.get(key);
            if (!zset) return 0;
            let removed = 0;
            for (const [member, score] of [...zset]) {
              if (score >= Number(min) && score <= Number(max)) {
                zset.delete(member);
                removed += 1;
              }
            }
            if (zset.size === 0) zsets.delete(key);
            return removed;
          });
          return pipe;
        },
        expire: vi.fn(() => pipe),
        exec: async () => {
          const results: unknown[] = [];
          for (const op of ops) {
            results.push(await op());
          }
          return results;
        },
      };
      return pipe;
    },
  };
  return { redis, store, zsets };
}

describe('SessionService', () => {
  let fake: ReturnType<typeof createFakeRedis>;
  let service: SessionService;

  beforeEach(() => {
    fake = createFakeRedis();
    service = new SessionService(fake.redis as never);
  });

  it('indexes sessions under rt:token:{tokenId} with a 7-day TTL (O(1) lookup key)', async () => {
    await service.createSession('user-1', 'token-1');
    expect(fake.store.get('rt:token:token-1')).toBe('user-1');
    expect(fake.redis.set).toHaveBeenCalledWith(
      'rt:token:token-1',
      'user-1',
      'EX',
      REFRESH_SESSION_TTL_SECONDS,
    );
    expect(REFRESH_SESSION_TTL_SECONDS).toBe(604800);
  });

  it('tracks active token ids in the rt:user_tokens:{userId} sorted set, scored by expiry (HARD-02)', async () => {
    const before = Date.now();
    await service.createSession('user-1', 'token-1');
    const after = Date.now();

    const zset = fake.zsets.get('rt:user_tokens:user-1');
    expect(zset?.has('token-1')).toBe(true);
    // Score = expiry epoch ms so expired members can be pruned by score range.
    const score = zset?.get('token-1') ?? Number.NaN;
    expect(score).toBeGreaterThanOrEqual(before + REFRESH_SESSION_TTL_SECONDS * 1000);
    expect(score).toBeLessThanOrEqual(after + REFRESH_SESSION_TTL_SECONDS * 1000);
    expect(fake.zsets.has('rt:user_tokens:user-2')).toBe(false);
    expect(fake.store.has('rt:token:other')).toBe(false);
  });

  it('prunes expired token ids on login so the index cannot grow unbounded (HARD-02)', async () => {
    // A stale member whose score (expiry) is already in the past: exactly what
    // a plain Set accumulated forever under a sliding TTL.
    fake.zsets.set('rt:user_tokens:user-1', new Map([['stale-token', Date.now() - 1000]]));

    await service.createSession('user-1', 'fresh-token');

    const zset = fake.zsets.get('rt:user_tokens:user-1');
    expect(zset?.has('stale-token')).toBe(false); // pruned by ZREMRANGEBYSCORE
    expect(zset?.has('fresh-token')).toBe(true); // new session indexed
  });

  it('resolves userId from a bare tokenId with a single GET (no SCAN)', async () => {
    await service.createSession('user-9', 'token-9');
    await expect(service.findSessionByTokenId('token-9')).resolves.toEqual({ userId: 'user-9' });
    await expect(service.findSessionByTokenId('missing')).resolves.toBeNull();
    // Regression guard: refresh is a hot path and must never iterate the keyspace.
    expect(fake.redis.scan).not.toHaveBeenCalled();
    expect(fake.redis.get).toHaveBeenCalledWith('rt:token:token-9');
  });

  it('revokes a single session, deindexes it, and marks the token as revoked', async () => {
    await service.createSession('user-1', 'token-1');
    await service.revokeSession('user-1', 'token-1');
    expect(fake.store.has('rt:token:token-1')).toBe(false);
    expect(fake.zsets.get('rt:user_tokens:user-1')?.has('token-1')).toBe(false);
    await expect(service.isRevoked('token-1')).resolves.toBe(true);
    expect(REVOKED_TOKEN_TTL_SECONDS).toBe(604800);
  });

  it('stores the owning userId in the denylist for security attribution (HARD-03)', async () => {
    await service.createSession('user-1', 'token-1');
    await service.revokeSession('user-1', 'token-1');

    // A later replay of the revoked token can be attributed to the account it
    // was stolen from instead of logging `userId: null`.
    await expect(service.getRevokedTokenUserId('token-1')).resolves.toBe('user-1');
    await expect(service.getRevokedTokenUserId('never-revoked')).resolves.toBeNull();
    await expect(service.isRevoked('token-1')).resolves.toBe(true);
  });

  it('revokes all sessions for a user via the token index and returns the count', async () => {
    await service.createSession('user-1', 'token-1');
    await service.createSession('user-1', 'token-2');
    await service.createSession('user-2', 'token-3');
    const revoked = await service.revokeAllSessions('user-1');
    expect(revoked).toBe(2);
    expect(fake.store.has('rt:token:token-1')).toBe(false);
    expect(fake.store.has('rt:token:token-2')).toBe(false);
    expect(fake.zsets.has('rt:user_tokens:user-1')).toBe(false);
    expect(fake.store.get('rt:token:token-3')).toBe('user-2');
    await expect(service.isRevoked('token-1')).resolves.toBe(true);
    await expect(service.getRevokedTokenUserId('token-1')).resolves.toBe('user-1');
    await expect(service.isRevoked('token-3')).resolves.toBe(false);
    // O(K) in the user's own sessions — never a keyspace iteration.
    expect(fake.redis.scan).not.toHaveBeenCalled();
  });

  it('returns 0 when revoking sessions for a user with none', async () => {
    await expect(service.revokeAllSessions('ghost')).resolves.toBe(0);
    expect(fake.redis.scan).not.toHaveBeenCalled();
  });

  it('never issues KEYS or SCAN — lookups are GET/ZRANGE only', async () => {
    await service.createSession('user-1', 'token-1');
    await service.findSessionByTokenId('token-1');
    await service.revokeAllSessions('user-1');
    expect('keys' in fake.redis).toBe(false);
    expect(fake.redis.scan).not.toHaveBeenCalled();
  });

  it('exposes stable key helpers', () => {
    expect(sessionKey('abc')).toBe('rt:token:abc');
    expect(userTokensKey('u1')).toBe('rt:user_tokens:u1');
  });

  it('stores password-reset tokens with a 1-hour TTL', async () => {
    await service.createPasswordResetToken('reset-1', 'user-1');
    expect(fake.store.get('pwd_reset:reset-1')).toBe('user-1');
    expect(fake.redis.set).toHaveBeenCalledWith(
      'pwd_reset:reset-1',
      'user-1',
      'EX',
      PASSWORD_RESET_TTL_SECONDS,
    );
    expect(PASSWORD_RESET_TTL_SECONDS).toBe(3600);
  });

  it('atomically consumes password-reset tokens exactly once', async () => {
    await service.createPasswordResetToken('reset-1', 'user-1');
    await expect(service.consumePasswordResetToken('reset-1')).resolves.toBe('user-1');
    await expect(service.consumePasswordResetToken('reset-1')).resolves.toBeNull();
    await expect(service.consumePasswordResetToken('missing')).resolves.toBeNull();
  });
});
