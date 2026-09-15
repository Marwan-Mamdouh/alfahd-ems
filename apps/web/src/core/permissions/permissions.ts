import type { Role } from "@/core/api/types";

export const PERMISSIONS = {
  "dashboard.view": ["ADMIN"],

  "employees.manage": ["ADMIN"],

  "attendance.view": ["ADMIN"],

  "warehouses.manage": ["ADMIN", "WAREHOUSE_STAFF"],

  "inventory.manage": ["ADMIN", "WAREHOUSE_STAFF"],

  "routers.manage": ["ADMIN", "WAREHOUSE_STAFF"],

  "ips.view": ["ADMIN", "WAREHOUSE_STAFF", "CUSTOMER_SERVICE"],

  "ips.manage": ["ADMIN"],

  "technicians.view": ["ADMIN"],

  "tracking.view": ["ADMIN"],

  "customers.view": ["ADMIN", "CUSTOMER_SERVICE"],

  "customers.manage": ["ADMIN", "CUSTOMER_SERVICE"],

  "tickets.view": ["ADMIN", "CUSTOMER_SERVICE"],

  "tickets.manage": ["ADMIN", "CUSTOMER_SERVICE"],

  "reports.view": ["ADMIN"],

  "settings.manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;

  return PERMISSIONS[permission].some((allowedRole) => allowedRole === role);
}
