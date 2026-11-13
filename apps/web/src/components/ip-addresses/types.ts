/**
 * IP Address Management — Frontend Display Models (Task B6)
 *
 * Real domain types backed by @alfahd/types.
 */

import type { IpStatus, IpHistoryAction } from "@alfahd/types";

export type { IpStatus, IpHistoryAction };

export interface IpAddressRow {
  id: string;
  address: string;
  status: IpStatus;
  isArchived: boolean;
  customerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IpFormValues {
  address: string;
  notes?: string;
}

export type IpStatusFilter = "all" | "FREE" | "RESERVED";
export type IpArchivedFilter = "active" | "archived" | "all";

