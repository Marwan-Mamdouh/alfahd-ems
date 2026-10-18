/**
 * Inventory Management — Frontend display models.
 *
 * Temporary types for Phase 2 UI development.
 * These are NOT the confirmed backend API DTOs.
 */

export interface InventoryItemRow {
  id: string;
  name: string;
  model: string;
  category: string;
  description: string | null;
}

export interface InventoryStockRow {
  id: string;
  itemId: string;
  itemName: string;
  model: string;
  category: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  lowStockThreshold: number;
}

export type InventoryMovementType = "INBOUND" | "OUTBOUND" | "RETURN";

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
}

export interface InventoryItemFormValues {
  name: string;
  model: string;
  category: string;
  description: string;
}

export interface InventoryMovementFormValues {
  itemId: string;
  warehouseId: string;
  type: InventoryMovementType;
  quantity: string;
  technicianId: string;
  supplierName: string;
  notes: string;
}
