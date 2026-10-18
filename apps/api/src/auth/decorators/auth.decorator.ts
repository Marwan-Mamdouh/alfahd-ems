import { applyDecorators, UseGuards } from '@nestjs/common';
import type { Role } from '@alfahd/types';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { Roles } from './roles.decorator.js';

export function Auth(...roles: (Role | Role[])[]) {
  const flatRoles = roles.flat();
  if (flatRoles.length > 0) {
    return applyDecorators(UseGuards(JwtAuthGuard), Roles(...flatRoles));
  }
  return applyDecorators(UseGuards(JwtAuthGuard));
}
