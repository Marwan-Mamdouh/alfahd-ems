import type { UserDto } from '@alfahd/types';
import { Role } from '@alfahd/types';
import type { User } from './index.js';

export const BCRYPT_COST = 12;

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
