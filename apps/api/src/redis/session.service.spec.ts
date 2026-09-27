import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_RESET_TTL_SECONDS,
  REFRESH_SESSION_TTL_SECONDS,
  REVOKED_TOKEN_TTL_SECONDS,
  SessionService,
} from './session.service.js';

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
}

function createFakeRedis() {
  const store = new Map<string, string>();
  const redis = {
    set: vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
      store.set(key, value);
      return 'OK';
    }),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    getdel: vi.fn(async (key: string) => {
      const value = store.get(key) ?? null;
      store.delete(key);
      return value;
    }),
    scan: vi.fn(async (cursor: string, ...args: unknown[]) => {
      const matchIndex = args.indexOf('MATCH');
      const pattern = matchIndex >= 0 ? String(args[matchIndex + 1]) : '*';
      const re = globToRegExp(pattern);
      const keys = [...store.keys()].filter((key) => re.test(key));
      return ['0', keys] as [string, string[]];
    }),
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
  return { redis, store };
}

describe('SessionService', () => {
  let fake: ReturnType<typeof createFakeRedis>;
  let service: SessionService;

  beforeEach(() => {
    fake = createFakeRedis();
    service = new SessionService(fake.redis as never);
  });

  it('creates sessions under rt:{userId}:{tokenId} with a 7-day TTL', async () => {
    await service.createSession('user-1', 'token-1');
    expect(fake.store.get('rt:user-1:token-1')).toBe('1');
    expect(fake.redis.set).toHaveBeenCalledWith(
      'rt:user-1:token-1',
      '1',
      'EX',
      REFRESH_SESSION_TTL_SECONDS,
    );
    expect(REFRESH_SESSION_TTL_SECONDS).toBe(604800);
  });

  it('stores created sessions under rt:{userId}:{tokenId}', async () => {
    await service.createSession('user-1', 'token-1');
    expect(fake.store.get('rt:user-1:token-1')).toBe('1');
    expect(fake.store.has('rt:user-1:other')).toBe(false);
    expect(fake.store.has('rt:user-2:token-1')).toBe(false);
  });

  it('resolves userId from a bare tokenId via SCAN', async () => {
    await service.createSession('user-9', 'token-9');
    await expect(service.findSessionByTokenId('token-9')).resolves.toEqual({ userId: 'user-9' });
    expect(fake.redis.scan).toHaveBeenCalled();
    await expect(service.findSessionByTokenId('missing')).resolves.toBeNull();
  });

  it('revokes a single session and marks the token as revoked', async () => {
    await service.createSession('user-1', 'token-1');
    await service.revokeSession('user-1', 'token-1');
    expect(fake.store.has('rt:user-1:token-1')).toBe(false);
    await expect(service.isRevoked('token-1')).resolves.toBe(true);
    expect(REVOKED_TOKEN_TTL_SECONDS).toBe(604800);
  });

  it('revokes all sessions for a user via SCAN and returns the count', async () => {
    await service.createSession('user-1', 'token-1');
    await service.createSession('user-1', 'token-2');
    await service.createSession('user-2', 'token-3');
    const revoked = await service.revokeAllSessions('user-1');
    expect(revoked).toBe(2);
    expect(fake.store.has('rt:user-1:token-1')).toBe(false);
    expect(fake.store.has('rt:user-1:token-2')).toBe(false);
    expect(fake.store.get('rt:user-2:token-3')).toBe('1');
    await expect(service.isRevoked('token-1')).resolves.toBe(true);
    await expect(service.isRevoked('token-3')).resolves.toBe(false);
  });

  it('returns 0 when revoking sessions for a user with none', async () => {
    await expect(service.revokeAllSessions('ghost')).resolves.toBe(0);
  });

  it('never issues KEYS — revocation discovery uses SCAN only', async () => {
    await service.createSession('user-1', 'token-1');
    await service.revokeAllSessions('user-1');
    expect('keys' in fake.redis).toBe(false);
    expect(fake.redis.scan).toHaveBeenCalled();
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
