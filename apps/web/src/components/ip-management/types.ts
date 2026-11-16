/**
 * IPv4 Pool & CSV Import — Component Interfaces & Wire Types
 *
 * Part of Phase 2 Epic #65, Issue #87 (F6).
 * Aligns with docs/contracts/phase-2-handoff.md and apps/web/src/phase2-handoff/interfaces.ts.
 *
 * Boundary:
 * Frontend owns presentational components, forms, interaction states, styling, and validation.
 * Backend owns API clients, query hooks, data containers, polling, and cache invalidation.
 */

// ─── 1. Wire & Backend DTOs (Mirrors frozen M2b Backend contracts) ────────────

/** Authoritative IP statuses enforced by PostgreSQL enum and Backend guards. */
export type IpStatus = "FREE" | "RESERVED";

/** Authoritative audit actions recorded in IP history ledger. */
export type IpHistoryAction =
  | "CREATE"
  | "RESERVE"
  | "RELEASE"
  | "ARCHIVE"
  | "UNARCHIVE"
  | "UPDATE_METADATA";

/**
 * Representation of an IPv4 address record returned by the API.
 * Corresponds to IpAddressDto in packages/types (PR #100).
 */
export interface IpAddressDto {
  id: string;
  address: string;
  status: IpStatus;
  isArchived: boolean;
  customerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload for single IPv4 creation via POST /ip-addresses */
export interface CreateIpDto {
  address: string;
  notes?: string;
}

/** Payload for updating metadata via PATCH /ip-addresses/:id */
export interface UpdateIpDto {
  notes?: string;
}

/** Audit history entry returned by GET /ip-addresses/:id/history */
export interface IpHistoryDto {
  id: string;
  ipId: string;
  fromStatus: IpStatus;
  toStatus: IpStatus;
  action: IpHistoryAction;
  reason: string | null;
  metadataBefore?: Record<string, unknown> | null;
  metadataAfter?: Record<string, unknown> | null;
  actorId: string;
  createdAt: string;
}

/** Query parameters for GET /ip-addresses */
export interface IpQueryDto {
  status?: IpStatus;
  isArchived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

/** Error details for an individual row in bulk CSV import */
export interface IpImportErrorRow {
  /** Physical row number in the uploaded CSV file (1-based, excluding or including header per parser) */
  row: number;
  address: string;
  reason: string;
}

/** Result summary of bulk CSV import */
export interface IpImportResultDto {
  total: number;
  inserted: number;
  skipped: number;
  errors: IpImportErrorRow[];
}

/** Lifecycle state of asynchronous BullMQ background jobs */
export type JobLifecycleStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

/** Polling response shape returned by GET /jobs/:id */
export interface JobStatusResponseDto {
  id: string;
  status: JobLifecycleStatus;
  downloadUrl?: string | null;
  error?: string | null;
  inserted?: number;
  skipped?: number;
  errors?: IpImportErrorRow[];
  result?: IpImportResultDto | null;
}

// ─── 2. General State Seam Models (Component-Container Boundary) ─────────────

/** Supplied remote data loading state */
export type Remote<T> =
  | { kind: "loading" }
  | { kind: "error"; message: string; retry?: () => void }
  | { kind: "empty" }
  | { kind: "ready"; value: T };

/** Paginated collection wrapper */
export interface Page<T> {
  items: readonly T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Form mutation execution and validation state */
export interface MutationState<TValues = unknown> {
  pending: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<keyof TValues, string>>;
}

/** Asynchronous job presentation state */
export type JobState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "polling"; job: JobStatusResponseDto }
  | { kind: "complete"; job: JobStatusResponseDto }
  | { kind: "error"; message: string };

// ─── 3. Capabilities & Aliases ───────────────────────────────────────────────

/** Presentational row model */
export type IpRow = IpAddressDto;

/** Presentational filter model */
export type IpFilter = IpQueryDto;

/** Legal action transitions for an IP */
export type IpActionType = "reserve" | "release" | "archive" | "unarchive";

/** Capability flags passed by the container based on user role and permissions */
export interface IpCapabilities {
  read: boolean;
  create: boolean;
  edit: boolean;
  reserve: boolean;
  archive: boolean;
  history: boolean;
  import: boolean;
}

// ─── 4. Presentational Component Contracts ───────────────────────────────────

/** Props for the IPv4 data table */
export interface IpTableProps {
  data: Remote<Page<IpRow>>;
  filter: IpFilter;
  capabilities: IpCapabilities;
  onFilterChange: (filter: IpFilter) => void;
  onPageChange: (page: number) => void;
  onSelectAction?: (ip: IpRow, action: IpActionType) => void;
  onSelectEdit?: (ip: IpRow) => void;
  onViewHistory?: (ip: IpRow) => void;
}

/** Form values for creating a single IPv4 host */
export interface IpCreateFormValues {
  address: string;
  notes?: string;
}

/** Props for the single IPv4 creation modal */
export interface IpCreateModalProps {
  isOpen: boolean;
  mutation: MutationState<IpCreateFormValues>;
  onSubmit: (values: IpCreateFormValues) => Promise<void>;
  onClose: () => void;
}

/** Form values for updating IP notes */
export interface IpEditNotesFormValues {
  notes: string;
}

/** Props for the modal to edit notes of an IPv4 address */
export interface IpEditNotesModalProps {
  isOpen: boolean;
  ip: IpRow | null;
  mutation: MutationState<IpEditNotesFormValues>;
  onSubmit: (ipId: string, notes: string) => Promise<void>;
  onClose: () => void;
}

/** Props for confirming state transitions (reserve, release, archive, unarchive) */
export interface IpActionDialogProps {
  isOpen: boolean;
  ip: IpRow | null;
  action: IpActionType | null;
  mutation: MutationState<{ reason?: string }>;
  onConfirm: (ipId: string, action: IpActionType, reason?: string) => Promise<void>;
  onClose: () => void;
}

/** Props for the slide-over history drawer */
export interface IpHistoryDrawerProps {
  isOpen: boolean;
  ip: IpRow | null;
  canView: boolean;
  data: Remote<readonly IpHistoryDto[]>;
  onClose: () => void;
}

/** Props for the bulk CSV upload modal and result viewer */
export interface IpCsvImportModalProps {
  isOpen: boolean;
  job: JobState;
  onImport: (file: File) => Promise<void>;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Top-level composite interface consumed by the page container.
 * Directly corresponds to IpProps in apps/web/src/phase2-handoff/interfaces.ts.
 */
export interface IpManagementProps {
  data: Remote<Page<IpRow>>;
  filter: IpFilter;
  capabilities: IpCapabilities;
  job: JobState;
  history: {
    selectedIp: IpRow | null;
    data: Remote<readonly IpHistoryDto[]>;
  };
  onFilterChange: (filter: IpFilter) => void;
  onPageChange: (page: number) => void;
  onCreate: (values: CreateIpDto) => Promise<void>;
  onEditNotes: (id: string, notes: string) => Promise<void>;
  onAction: (id: string, action: IpActionType, reason?: string) => Promise<void>;
  onImportCsv: (file: File) => Promise<void>;
  onResetJob: () => void;
  onViewHistory: (ip: IpRow | null) => void;
}
