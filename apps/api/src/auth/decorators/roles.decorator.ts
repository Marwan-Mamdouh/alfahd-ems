import { SetMetadata } from '@nestjs/common';
import type { Role } from '@alfahd/types';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: (Role | Role[])[]) => {
  const flatRoles = roles.flat();
  return SetMetadata(ROLES_KEY, flatRoles);
};
