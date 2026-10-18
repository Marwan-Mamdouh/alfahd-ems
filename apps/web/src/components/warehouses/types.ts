/**
 * Frontend display models for Warehouse Management.
 *
 * These types are temporary until the backend
 * API contract is confirmed.
 */

export interface WarehouseRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  staffCount: number;
  itemCount: number;
}

export interface WarehouseFormValues {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
}

export interface WarehouseStaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface WarehouseMovementRow {
  id: string;
  itemName: string;
  type: "INBOUND" | "OUTBOUND" | "RETURN";
  quantity: number;
  createdAt: string;
  performedBy: string;
}
