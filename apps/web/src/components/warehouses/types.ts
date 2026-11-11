/**
 * Frontend display models for Warehouse Management.
 */

export interface WarehouseRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  managerId: string | null;
  isActive: boolean;
  staffCount?: number;
  itemCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseFormValues {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadiusMeters: string;
  managerId: string;
}

export interface WarehouseStaffRow {
  id: string;
  name: string;
  email?: string;
  role: string;
  status?: string;
  isEligible?: boolean;
}

export interface WarehouseMovementRow {
  id: string;
  itemName: string;
  type: string;
  quantity: number;
  createdAt: string;
  performedBy: string;
}
