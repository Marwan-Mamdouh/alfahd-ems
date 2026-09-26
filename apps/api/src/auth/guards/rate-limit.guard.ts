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
export const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes

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
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
    }
    if (attempts > LOGIN_RATE_LIMIT_MAX) {
      throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
