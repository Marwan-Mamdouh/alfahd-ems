import { Role } from "@alfahd/types";

/**
 * Phase 2 Role & Action Permission Matrix
 *
 * Authoritative mapping matching the approved handoff in docs/contracts/phase-2-handoff.md:
 * - A = ADMIN
 * - W = WAREHOUSE_STAFF
 * - C = CS (Customer Service)
 * - T = TECHNICIAN
 */
export const PERMISSIONS = {
  // --- Dashboard ---
  "dashboard.view": [Role.ADMIN],

  // --- Employees (A2) ---
  "employees.view": [Role.ADMIN],
  "employees.manage": [Role.ADMIN],
  "employees.lookup": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "employees.status": [Role.ADMIN],
  "employees.photo": [Role.ADMIN],

  // --- Attendance (A2) ---
  "attendance.view": [Role.ADMIN],
  "attendance.override": [Role.ADMIN],
  "attendance.report": [Role.ADMIN],
  "attendance.checkin": [Role.TECHNICIAN],

  // --- Warehouses (A2) ---
  "warehouses.view": [Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS],
  "warehouses.manage": [Role.ADMIN],
  "warehouses.create": [Role.ADMIN],
  "warehouses.update": [Role.ADMIN],
  "warehouses.deactivate": [Role.ADMIN],

  // --- Products (A2) ---
  "products.view": [Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN],
  "products.manage": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "products.create": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "products.update": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "products.deactivate": [Role.ADMIN],

  // --- Inventory (A2) ---
  "inventory.view": [Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS],
  "inventory.manage": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "inventory.movement": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "inventory.adjust": [Role.ADMIN],

  // --- Routers (A2) ---
  "routers.view": [Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN],
  "routers.manage": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "routers.assign": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "routers.transition": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "routers.condition": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "routers.audit": [Role.ADMIN, Role.WAREHOUSE_STAFF],
  "routers.export": [Role.ADMIN],

  // --- IPv4 Addresses (A2/B6) ---
  "ips.view": [Role.ADMIN, Role.TECHNICIAN],
  "ips.manage": [Role.ADMIN],
  "ips.import": [Role.ADMIN],
  "ips.history": [Role.ADMIN],

  // --- Technicians Operations (Future / Excluded) ---
  "technicians.view": [Role.ADMIN],

  // --- Live Tracking (Future / Excluded) ---
  "tracking.view": [Role.ADMIN],

  // --- Customers & CRM (Future / Excluded) ---
  "customers.view": [Role.ADMIN, Role.CS],
  "customers.manage": [Role.ADMIN, Role.CS],

  // --- Tickets (M3a / Excluded) ---
  "tickets.view": [Role.ADMIN, Role.CS],
  "tickets.manage": [Role.ADMIN, Role.CS],

  // --- System Reports & Settings (Future / Excluded) ---
  "reports.view": [Role.ADMIN],
  "settings.manage": [Role.ADMIN],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Checks whether a given role holds the specified permission.
 */
export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).some((allowedRole) => allowedRole === role);
}

// ============================================================================
// Action-Level Capability Interfaces & Getters
// ============================================================================

export interface EmployeeCapabilities {
  canView: boolean;
  canManage: boolean;
  canLookup: boolean;
  canChangeStatus: boolean;
  canUploadPhoto: boolean;
}

export interface AttendanceCapabilities {
  canView: boolean;
  canOverride: boolean;
  canExportReport: boolean;
  canCheckInOut: boolean;
}

export interface WarehouseCapabilities {
  canView: boolean;
  canManage: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}

export interface ProductCapabilities {
  canView: boolean;
  canManage: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}

export interface InventoryCapabilities {
  canViewStock: boolean;
  canManage: boolean;
  canRecordMovement: boolean;
  canAdjustStock: boolean;
}

export interface RouterCapabilities {
  canView: boolean;
  canManage: boolean;
  canAssign: boolean;
  canTransition: boolean;
  canUpdateCondition: boolean;
  canExport: boolean;
}

export interface IpCapabilities {
  canView: boolean;
  canManage: boolean;
  canImport: boolean;
  isReadOnly: boolean;
  isDenied: boolean;
}

export function getEmployeeCapabilities(role: Role | undefined): EmployeeCapabilities {
  return {
    canView: hasPermission(role, "employees.view"),
    canManage: hasPermission(role, "employees.manage"),
    canLookup: hasPermission(role, "employees.lookup"),
    canChangeStatus: hasPermission(role, "employees.status"),
    canUploadPhoto: hasPermission(role, "employees.photo"),
  };
}

export function getAttendanceCapabilities(role: Role | undefined): AttendanceCapabilities {
  return {
    canView: hasPermission(role, "attendance.view"),
    canOverride: hasPermission(role, "attendance.override"),
    canExportReport: hasPermission(role, "attendance.report"),
    canCheckInOut: hasPermission(role, "attendance.checkin"),
  };
}

export function getWarehouseCapabilities(role: Role | undefined): WarehouseCapabilities {
  return {
    canView: hasPermission(role, "warehouses.view"),
    canManage: hasPermission(role, "warehouses.manage"),
    canCreate: hasPermission(role, "warehouses.create"),
    canUpdate: hasPermission(role, "warehouses.update"),
    canDeactivate: hasPermission(role, "warehouses.deactivate"),
  };
}

export function getProductCapabilities(role: Role | undefined): ProductCapabilities {
  return {
    canView: hasPermission(role, "products.view"),
    canManage: hasPermission(role, "products.manage"),
    canCreate: hasPermission(role, "products.create"),
    canUpdate: hasPermission(role, "products.update"),
    canDeactivate: hasPermission(role, "products.deactivate"),
  };
}

export function getInventoryCapabilities(role: Role | undefined): InventoryCapabilities {
  return {
    canViewStock: hasPermission(role, "inventory.view"),
    canManage: hasPermission(role, "inventory.manage"),
    canRecordMovement: hasPermission(role, "inventory.movement"),
    canAdjustStock: hasPermission(role, "inventory.adjust"),
  };
}

export function getRouterCapabilities(role: Role | undefined): RouterCapabilities {
  return {
    canView: hasPermission(role, "routers.view"),
    canManage: hasPermission(role, "routers.manage"),
    canAssign: hasPermission(role, "routers.assign"),
    canTransition: hasPermission(role, "routers.transition"),
    canUpdateCondition: hasPermission(role, "routers.condition"),
    canExport: hasPermission(role, "routers.export"),
  };
}

export function getIpCapabilities(role: Role | undefined): IpCapabilities {
  const canView = hasPermission(role, "ips.view");
  const canManage = hasPermission(role, "ips.manage");
  return {
    canView,
    canManage,
    canImport: hasPermission(role, "ips.import"),
    isReadOnly: canView && !canManage,
    isDenied: !canView,
  };
}
