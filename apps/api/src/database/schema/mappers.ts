import type { UserDto } from '@alfahd/types';
import { Role } from '@alfahd/types';
import type { User } from './index.js';

export const ARGON2_OPTIONS = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
