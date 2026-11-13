/**
 * Inventory Management — Frontend display models.
 */

import type { StockMovementType } from "@alfahd/types";

export interface InventoryItemRow {
  id: string;
  name: string;
  sku?: string;
  model: string;
  category: string;
  description: string | null;
  lowStockThreshold?: number;
  isSerialized?: boolean;
  isActive?: boolean;
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

export type LegacyMovementAlias = "INBOUND" | "OUTBOUND" | "RETURN";
export type InventoryMovementType = StockMovementType | LegacyMovementAlias;

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
}

export interface InventoryItemFormValues {
  name: string;
  sku: string;
  model: string;
  category: string;
  description: string;
  lowStockThreshold: string;
}

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
