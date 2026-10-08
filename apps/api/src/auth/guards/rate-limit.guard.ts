import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants.js';

export const LOGIN_RATE_LIMIT_MAX = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 600_000; // 10 minutes in ms
export const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 600;

export function rateLimitKey(ip: string): string {
  return `rl:login:${ip}`;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const key = rateLimitKey(ip);
    const now = Date.now();
    const windowStart = now - LOGIN_RATE_LIMIT_WINDOW_MS;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
    pipeline.zcard(key);
    pipeline.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
    const results = await pipeline.exec();

    // results[2] is the ZCARD result: [error, count]
    const count = (results?.[2]?.[1] as number) ?? 0;

    if (count > LOGIN_RATE_LIMIT_MAX) {
      throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
