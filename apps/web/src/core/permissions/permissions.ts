import type { Role } from "@alfahd/types";

export const PERMISSIONS = {
  "dashboard.view": ["ADMIN"],

  "employees.manage": ["ADMIN"],

  "attendance.view": ["ADMIN"],

  "warehouses.manage": ["ADMIN", "WAREHOUSE_STAFF"],

  "inventory.manage": ["ADMIN", "WAREHOUSE_STAFF"],

  "routers.manage": ["ADMIN", "WAREHOUSE_STAFF"],

  "ips.view": ["ADMIN", "WAREHOUSE_STAFF", "CS"],

  "ips.manage": ["ADMIN"],

  "technicians.view": ["ADMIN"],

  "tracking.view": ["ADMIN"],

  "customers.view": ["ADMIN", "CS"],

  "customers.manage": ["ADMIN", "CS"],

  "tickets.view": ["ADMIN", "CS"],

  "tickets.manage": ["ADMIN", "CS"],

  "reports.view": ["ADMIN"],

  "settings.manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;

  return PERMISSIONS[permission].some((allowedRole) => allowedRole === role);
}
