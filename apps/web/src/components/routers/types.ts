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
