/**
 * Router Management — Frontend Display Models
 *
 * Real domain types backed by @alfahd/types.
 */

import type {
  RouterStatus,
  RouterPhysicalCondition,
  RouterHolderType,
} from "@alfahd/types";

export type { RouterStatus, RouterPhysicalCondition, RouterHolderType };

export interface RouterRow {
  id: string;
  serialNumber: string;
  productId: string;
  productName: string;
  productSku?: string;
  productModel?: string;
  status: RouterStatus;
  physicalCondition: RouterPhysicalCondition;
  warehouseId: string | null;
  warehouseName: string | null;
  externalLocation: string | null;
  currentHolderType: RouterHolderType | null;
  currentHolderId: string | null;
  currentHolderName?: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RouterFilter {
  search?: string;
  status?: RouterStatus | "all";
  physicalCondition?: RouterPhysicalCondition | "all";
  warehouseId?: string | "all";
}

export interface RouterRegistrationFormValues {
  serialNumber: string;
  productId: string;
  warehouseId: string;
  physicalCondition: RouterPhysicalCondition;
  isNewReceipt: boolean;
  notes: string;
}

// Retain alias for backward compatibility with existing imports
export type RouterFormValues = RouterRegistrationFormValues;

export interface RouterAssignmentFormValues {
  routerId: string;
  technicianId: string;
  notes: string;
}

export interface RouterTransitionFormValues {
  status: RouterStatus;
  reason: string;
  targetWarehouseId?: string;
  notes?: string;
}

export interface RouterConditionFormValues {
  physicalCondition: RouterPhysicalCondition;
  locationType: "warehouse" | "external";
  warehouseId?: string;
  externalLocation?: string;
  reason: string;
}

export interface RouterAssignmentItem {
  id: string;
  routerId: string;
  holderType: RouterHolderType;
  warehouseId: string | null;
  technicianId: string | null;
  customerId?: string | null;
  assignedBy: string;
  assignedAt: string;
  releasedAt: string | null;
  notes: string | null;
}

export interface RouterConditionHistoryItem {
  id: string;
  routerId: string;
  fromCondition: RouterPhysicalCondition;
  toCondition: RouterPhysicalCondition;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  externalLocation: string | null;
  reason: string;
  changedBy: string;
  createdAt: string;
}

export interface RouterStatusHistoryItem {
  id: string;
  routerId: string;
  fromStatus: RouterStatus;
  toStatus: RouterStatus;
  reason: string;
  changedBy: string;
  createdAt: string;
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

export interface RouterCapabilities {
  canManage: boolean;
  canExport: boolean;
  canAssign: boolean;
  canTransition: boolean;
  canUpdateCondition: boolean;
}

export type JobStatusType = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export interface RouterReportJobState {
  id?: string;
  status: JobStatusType;
  progress?: number;
  downloadUrl?: string;
  error?: string;
}
