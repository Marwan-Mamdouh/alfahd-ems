import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

export const REFRESH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const REVOKED_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function sessionKey(userId: string, tokenId: string): string {
  return `rt:${userId}:${tokenId}`;
}

export function revokedKey(tokenId: string): string {
  return `rv:${tokenId}`;
}

@Injectable()
export class SessionService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async createSession(userId: string, tokenId: string): Promise<void> {
    await this.redis.set(sessionKey(userId, tokenId), '1', 'EX', REFRESH_SESSION_TTL_SECONDS);
  }

  async validateSession(userId: string, tokenId: string): Promise<boolean> {
    return (await this.redis.exists(sessionKey(userId, tokenId))) === 1;
  }

  /** Resolve the owning userId for a refresh tokenId. Refresh tokens are UUIDs, not JWTs. */
  async findSessionByTokenId(tokenId: string): Promise<{ userId: string } | null> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `rt:*:${tokenId}`, 'COUNT', 100);
      cursor = next;
      const match = keys[0];
      if (match !== undefined) {
        return { userId: match.slice(3, match.length - tokenId.length - 1) };
      }
    } while (cursor !== '0');
    return null;
  }

  async revokeSession(userId: string, tokenId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(sessionKey(userId, tokenId));
    pipeline.set(revokedKey(tokenId), '1', 'EX', REVOKED_TOKEN_TTL_SECONDS);
    await pipeline.exec();
  }

  /** Delete all `rt:{userId}:*` keys via SCAN (never KEYS). Returns the revoked count. */
  async revokeAllSessions(userId: string): Promise<number> {
    const prefix = `rt:${userId}:`;
    const tokenIds: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = next;
      for (const key of keys) {
        tokenIds.push(key.slice(prefix.length));
      }
    } while (cursor !== '0');
    if (tokenIds.length === 0) {
      return 0;
    }
    const pipeline = this.redis.pipeline();
    for (const tokenId of tokenIds) {
      pipeline.del(sessionKey(userId, tokenId));
      pipeline.set(revokedKey(tokenId), '1', 'EX', REVOKED_TOKEN_TTL_SECONDS);
    }
    await pipeline.exec();
    return tokenIds.length;
  }

  /** True when the tokenId was explicitly revoked (denylist), as opposed to merely expired. */
  async isRevoked(tokenId: string): Promise<boolean> {
    return (await this.redis.exists(revokedKey(tokenId))) === 1;
  }
}
