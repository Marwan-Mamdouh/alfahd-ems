import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUser } from '../strategies/jwt.strategy.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    return request.user;
  },
);
