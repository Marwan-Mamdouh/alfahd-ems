/**
 * Frontend display models and types for Warehouse Management.
 * Conforms to Phase 2 contracts and backend DTOs.
 */

export interface RemoteLoading {
  kind: "loading";
}

export interface RemoteError {
  kind: "error";
  message: string;
  retry?: () => void;
}

export interface RemoteEmpty {
  kind: "empty";
}

export interface RemoteReady<T> {
  kind: "ready";
  value: T;
}

export type Remote<T> = RemoteLoading | RemoteError | RemoteEmpty | RemoteReady<T>;

export interface WarehouseRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  managerId: string | null;
  managerName?: string | null;
  isActive: boolean;
  staffCount?: number;
  itemCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseFilter {
  search?: string;
  isActive?: boolean | "all";
}

export interface WarehouseFormValues {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadiusMeters: string;
  managerId: string;
}

export interface WarehouseCapabilities {
  create: boolean;
  edit: boolean;
  deactivate: boolean;
}

/**
 * Filtered manager option: active ADMIN or WAREHOUSE_STAFF only.
 * No PII (no national IDs, emails, or phone numbers).
 */
export interface ManagerOption {
  id: string;
  name: string;
  role: "ADMIN" | "WAREHOUSE_STAFF";
  status: "ACTIVE";
}

export interface ManagerSelector {
  options: Remote<readonly ManagerOption[]> | readonly ManagerOption[];
  search?: string;
  onSearchChange?: (search: string) => void;
  currentOnly?: { id: string; name: string | null; reason: "inactive" | "unresolved" } | null;
}

export interface WarehouseStaffRow {
  id: string;
  name: string;
  role: string;
  status?: string;
  isEligible?: boolean;
}

export interface WarehouseStockRow {
  id: string;
  itemId?: string;
  itemName: string;
  model: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
}

export interface WarehouseMovementRow {
  id: string;
  itemName: string;
  type: string;
  quantity: number;
  createdAt: string;
  performedBy: string;
}

export interface WarehouseRouterRow {
  id: string;
  serialNumber: string;
  model: string;
  status: string;
  physicalCondition: string;
}
