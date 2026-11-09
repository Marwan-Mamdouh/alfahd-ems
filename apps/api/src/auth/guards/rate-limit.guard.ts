import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../../redis/redis.constants.js';

export const LOGIN_RATE_LIMIT_MAX = 60;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 600_000;
export const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 600;

// Use a new key so entries from the old all-requests policy are not counted.
export function rateLimitKey(ip: string): string {
  return `rl:login:failures:${ip}`;
}

export function loginIp(request: Request): string {
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

// Validates on every request — successful logins cost 0; only real credential
// rejections are recorded later by `recordFailure`, so blocked retries and
// successes never consume the budget. Pruning and checking are atomic across
// API instances.
const CHECK_LIMIT = `
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1] - ARGV[2])
  local count = redis.call('ZCARD', KEYS[1])
  if count >= tonumber(ARGV[3]) then
    -- 61st+ request blocks until enough of the oldest failures expire; report
    -- remaining seconds so the client can show a countdown.
    local index = count - tonumber(ARGV[3])
    local oldest = redis.call('ZRANGE', KEYS[1], index, index, 'WITHSCORES')
    return math.max(1, math.ceil((oldest[2] + ARGV[2] - ARGV[1]) / 1000))
  end
  return 0
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const retryAfter = Number(
      await this.redis.eval(
        CHECK_LIMIT,
        1,
        rateLimitKey(loginIp(request)),
        Date.now(),
        LOGIN_RATE_LIMIT_WINDOW_MS,
        LOGIN_RATE_LIMIT_MAX,
      ),
    );
    if (retryAfter > 0) {
      http.getResponse<Response>().setHeader('Retry-After', String(retryAfter));
      throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  async recordFailure(request: Request): Promise<void> {
    const key = rateLimitKey(loginIp(request));
    const pipeline = this.redis.pipeline();
    pipeline.zadd(key, Date.now(), randomUUID());
    pipeline.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
    try {
      const results = await pipeline.exec();
      if (!results || results.some(([error]) => error)) {
        throw new Error('redis pipeline reported an error');
      }
    } catch (error) {
      // Recording is best-effort: a Redis blip between the guard's check and
      // this call must not convert the client's 401 into a 500, and losing a
      // few failure entries only shortens the brute-force window.
      this.logger.warn('Could not record a failed login attempt', {
        reason: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }
}
