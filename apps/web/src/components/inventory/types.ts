/**
 * Inventory & Product Management — Frontend display models and types.
 * Aligned with Phase 2 contracts (#67, #76, #77, #81) and backend DTOs.
 */

import type { Role, StockMovementType } from "@alfahd/types";

export type MovementType =
  | "INBOUND_SUPPLIER"
  | "OUTBOUND_TECHNICIAN"
  | "RETURN_TECHNICIAN"
  | "TRANSFER_WAREHOUSE"
  | "ADJUSTMENT";

export type LegacyMovementAlias = "INBOUND" | "OUTBOUND" | "RETURN";
export type InventoryMovementType = MovementType | StockMovementType | LegacyMovementAlias;

export interface ProductRow {
  id: string;
  name: string;
  sku: string;
  model: string;
  category: string;
  description: string | null;
  lowStockThreshold: number;
  isSerialized: boolean;
  isActive: boolean;
  totalStock?: number;
  isLowStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type InventoryItemRow = ProductRow;

export interface ProductFilter {
  search?: string;
  category?: string;
  isLowStock?: boolean;
  activeOnly?: boolean;
  isActive?: boolean | "all";
}

export interface ProductFormValues {
  name: string;
  sku: string;
  model: string;
  category: string;
  description: string;
  lowStockThreshold: string;
}

export type InventoryItemFormValues = ProductFormValues;

export interface ProductCapabilities {
  create: boolean;
  edit: boolean;
  deactivate: boolean;
  reactivate?: boolean;
}

export interface InventoryStockRow {
  id: string;
  itemId: string;
  itemName: string;
  model: string;
  category: string;
  sku?: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  lowStockThreshold: number;
  isSerialized?: boolean;
}

export type InventoryRow = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  productName: string;
  warehouseName: string;
};

export interface InventoryMovementRow {
  id: string;
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  type: InventoryMovementType;
  quantity: number;
  performedBy: string;
  createdAt: string;
  notes: string | null;
  supplierName?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  toWarehouseId?: string | null;
  toWarehouseName?: string | null;
}

export type StockMovementRow = InventoryMovementRow;

export interface InventoryMovementFormValues {
  itemId: string;
  warehouseId: string;
  type: InventoryMovementType;
  quantity: string;
  technicianId: string;
  supplierName: string;
  toWarehouseId?: string;
  newQuantity?: string;
  notes: string;
}

export interface MovementFilter {
  warehouseId?: string;
  productId?: string;
  movementType?: InventoryMovementType | "all";
  technicianId?: string;
  search?: string;
}

export interface SelectOption {
  id: string;
  name: string;
}

export interface ItemSelectOption extends SelectOption {
  isSerialized?: boolean;
  sku?: string;
  category?: string;
  model?: string;
}

export type CurrentUserRole = Role | null | undefined;
