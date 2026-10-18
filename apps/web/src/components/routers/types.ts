/**
 * Router Management — Frontend Display Models
 *
 * Temporary UI types for Phase 2.
 * These are not confirmed backend DTOs.
 */

export type RouterStatus = "IN_STOCK" | "ASSIGNED" | "INSTALLED" | "RETURNED" | "DAMAGED";

export interface RouterRow {
  id: string;
  serialNumber: string;
  brand: string;
  model: string;
  status: RouterStatus;
  warehouseId: string | null;
  warehouseName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: string;
}

export interface RouterFormValues {
  serialNumber: string;
  brand: string;
  model: string;
  warehouseId: string;
}

export interface RouterAssignmentFormValues {
  routerId: string;
  technicianId: string;
  notes: string;
}

export interface RouterHistoryRow {
  id: string;
  routerId: string;
  action: string;
  previousStatus: RouterStatus | null;
  newStatus: RouterStatus;
  performedBy: string;
  createdAt: string;
  notes: string | null;
}
