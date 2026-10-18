import type { EmployeeDto, UserDto, UserStatus } from '@alfahd/types';
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

export function toEmployeeDto(user: User): EmployeeDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    department: user.department ?? null,
    phone: user.phone,
    nationalId: user.nationalId,
    hireDate: user.hireDate,
    status: (user.status as UserStatus) ?? (user.isActive ? 'ACTIVE' : 'INACTIVE'),
    assignedWarehouseId: user.assignedWarehouseId,
    profilePhotoKey: user.profilePhotoKey,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
