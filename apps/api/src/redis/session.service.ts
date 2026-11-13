import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

export const REFRESH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const REVOKED_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const ROTATED_TOKEN_TTL_SECONDS = REVOKED_TOKEN_TTL_SECONDS;
export const PASSWORD_RESET_TTL_SECONDS = 3600; // 1 hour
export const PASSWORD_RESET_KEY_PREFIX = 'pwd_reset:';

/**
 * Session lookup key: `rt:token:{tokenId}` → userId (O(1) GET).
 *
 * The previous layout (`rt:{userId}:{tokenId}` + SCAN on every refresh) forced
 * a full-keyspace iteration per token refresh — O(N) Redis CPU on a
 * high-frequency path. Token refresh is now a single deterministic read.
 */
export function sessionKey(tokenId: string): string {
  return `rt:token:${tokenId}`;
}

/**
 * Per-user index of active token ids: a Sorted Set `rt:user_tokens:{userId}`
 * scored by expiry timestamp (ms since epoch), so "revoke all sessions for
 * user" is O(K) in that user's sessions instead of a keyspace SCAN, and
 * expired ids are pruned as they accumulate instead of growing the index
 * unboundedly under a sliding TTL (a plain Set re-expired forever while
 * dead members piled up).
 */
export function userTokensKey(userId: string): string {
  return `rt:user_tokens:${userId}`;
}

export function revokedKey(tokenId: string): string {
  return `rv:${tokenId}`;
}

export function rotatedKey(tokenId: string): string {
  return `rt:rotated:${tokenId}`;
}

const CONSUME_AND_MARK_ROTATED = `
local userId = redis.call('GETDEL', KEYS[1])
if userId then
  redis.call('SET', KEYS[2], userId, 'EX', ARGV[1])
end
return userId
`;

@Injectable()
export class SessionService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async createSession(userId: string, tokenId: string): Promise<void> {
    const userTokens = userTokensKey(userId);
    const nowMs = Date.now();
    const expiresAtMs = nowMs + REFRESH_SESSION_TTL_SECONDS * 1000;
    const pipeline = this.redis.pipeline();
    // Prune expired token ids for this user before adding the new one, so the
    // index stays bounded even though `expire` slides the key's TTL on every login.
    pipeline.zremrangebyscore(userTokens, 0, nowMs);
    pipeline.zadd(userTokens, expiresAtMs, tokenId);
    pipeline.expire(userTokens, REFRESH_SESSION_TTL_SECONDS);
    pipeline.set(sessionKey(tokenId), userId, 'EX', REFRESH_SESSION_TTL_SECONDS);
    await pipeline.exec();
  }

  /**
   * Atomically consume a refresh token id (GETDEL) and write the rotated marker
   * (`rt:rotated:{tokenId}` EX <ttl>) in a single Lua script execution.
   *
   * This eliminates the race window between consuming the old token and marking
   * it as rotated, so a losing concurrent tab calling refresh never observes the
   * token as an unknown/dead token and therefore does not clear the winner's cookie.
   */
  async consumeSessionForRotation(tokenId: string): Promise<string | null> {
    return this.redis.eval(
      CONSUME_AND_MARK_ROTATED,
      2,
      sessionKey(tokenId),
      rotatedKey(tokenId),
      ROTATED_TOKEN_TTL_SECONDS,
    ) as Promise<string | null>;
  }

  /**
   * Remove the rotated marker for a token id. Used when an inactive/deactivated user
   * attempts a refresh: since the account is inactive, the session is dead and the
   * client cookie SHOULD be cleared.
   */
  async clearRotated(tokenId: string): Promise<void> {
    await this.redis.del(rotatedKey(tokenId));
  }

  /** True when the tokenId was rotated on a previous refresh request. */
  async isRotated(tokenId: string): Promise<boolean> {
    return (await this.redis.exists(rotatedKey(tokenId))) === 1;
  }

  async revokeSession(userId: string, tokenId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(sessionKey(tokenId));
    pipeline.zrem(userTokensKey(userId), tokenId);
    // Store the owning userId (not a bare flag) so a later replay attempt can
    // be attributed to the targeted account in security logs.
    pipeline.set(revokedKey(tokenId), userId, 'EX', REVOKED_TOKEN_TTL_SECONDS);
    await pipeline.exec();
  }

  /** Revoke every session indexed for a user (O(K)). Returns the revoked count. */
  async revokeAllSessions(userId: string): Promise<number> {
    const userTokens = userTokensKey(userId);
    const tokenIds = await this.redis.zrange(userTokens, '0', '-1');
    if (tokenIds.length === 0) {
      return 0;
    }
    const pipeline = this.redis.pipeline();
    for (const tokenId of tokenIds) {
      pipeline.del(sessionKey(tokenId));
      pipeline.set(revokedKey(tokenId), userId, 'EX', REVOKED_TOKEN_TTL_SECONDS);
    }
    pipeline.del(userTokens);
    await pipeline.exec();
    return tokenIds.length;
  }

  /** True when the tokenId was explicitly revoked (denylist), as opposed to merely expired. */
  async isRevoked(tokenId: string): Promise<boolean> {
    return (await this.redis.exists(revokedKey(tokenId))) === 1;
  }

  /**
   * The userId a revoked denylist entry belongs to — lets security logging
   * attribute a revoked-token replay to the account it was stolen from.
   * Returns null when the tokenId was never revoked.
   */
  async getRevokedTokenUserId(tokenId: string): Promise<string | null> {
    return this.redis.get(revokedKey(tokenId));
  }

  /** Store a password-reset token (single-use, 1-hour TTL). */
  async createPasswordResetToken(token: string, userId: string): Promise<void> {
    await this.redis.set(
      `${PASSWORD_RESET_KEY_PREFIX}${token}`,
      userId,
      'EX',
      PASSWORD_RESET_TTL_SECONDS,
    );
  }

  /** Atomically consume a password-reset token. Returns userId or null if missing/expired. */
  async consumePasswordResetToken(token: string): Promise<string | null> {
    return this.redis.getdel(`${PASSWORD_RESET_KEY_PREFIX}${token}`);
  }
}
