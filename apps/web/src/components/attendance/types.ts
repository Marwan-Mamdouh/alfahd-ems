import type {
  AttendanceListItemDto,
  AttendanceStatus,
  Department,
  JobStatusResponseDto,
  OverrideAttendanceDto,
} from "@alfahd/types";

/**
 * Attendance record model for frontend presentation.
 * Aligned with the authoritative backend AttendanceListItemDto,
 * with optional aliases for backward compatibility.
 */
export interface AttendanceRow extends AttendanceListItemDto {
  /** Optional legacy alias for userId */
  employeeId?: string;
  /** Optional legacy alias for workDate */
  date?: string;
  /** Optional legacy alias for checkInAt */
  checkIn?: string | null;
  /** Optional legacy alias for checkOutAt */
  checkOut?: string | null;
  /** Optional legacy alias for minutes worked */
  workingMinutes?: number | null;
}

/**
 * Filter values for querying the attendance list.
 */
export interface AttendanceFiltersValue {
  search: string;
  dateFrom: string;
  dateTo: string;
  department: string;
  status: string;
}

export type AttendanceFilter = {
  from?: string;
  to?: string;
  employeeId?: string;
  department?: Department | "";
  status?: AttendanceStatus | "";
  search?: string;
};

/**
 * Accurate server-provided attendance totals across all matching records,
 * not merely the current paginated view.
 */
export interface AttendanceTotals {
  total: number;
  onTime: number;
  late: number;
}

/**
 * Paginated attendance page envelope.
 */
export interface AttendancePage {
  page: {
    items: readonly AttendanceRow[];
    total: number;
    page: number;
    pageSize: number;
  };
  totals: AttendanceTotals;
}

/**
 * Presentation load state for attendance data.
 */
export type AttendanceLoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string; retry?: () => void }
  | { kind: "ready"; value: AttendancePage }
  | { kind: "empty" }
  | { kind: "forbidden"; message?: string };

/**
 * Action-level capabilities for attendance features.
 */
export interface AttendanceCapabilities {
  view: boolean;
  override: boolean;
  export: boolean;
}

/**
 * State representing asynchronous background export job lifecycle.
 */
export type Job =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "polling"; job: JobStatusResponseDto }
  | { kind: "complete"; job: JobStatusResponseDto }
  | { kind: "error"; message: string };

/**
 * Form values for an admin attendance override.
 */
export interface OverrideAttendanceFormData {
  checkInAt?: string;
  checkOutAt?: string;
  status?: AttendanceStatus;
  overrideReason: string;
}

/**
 * Parameters for requesting an attendance Excel report.
 */
export interface ReportExportFormData {
  from: string;
  to: string;
  department?: Department;
  employeeId?: string;
}

/**
 * Props for the unified Attendance management presentational component.
 */
export interface AttendanceProps {
  data: AttendanceLoadState;
  filter: AttendanceFiltersValue;
  capabilities: AttendanceCapabilities;
  onFilterChange: (filter: AttendanceFiltersValue) => void;
  onPageChange: (page: number) => void;
  job?: Job;
  onOverride?: (id: string, value: OverrideAttendanceDto) => Promise<void>;
  onExportRequest?: (params: ReportExportFormData) => Promise<void>;
  onDownload?: (jobId: string, url: string) => void;
}

/**
 * Filter for employee-specific history (department is fixed to the employee).
 */
export type EmployeeAttendanceHistoryFilter = Pick<
  AttendanceFiltersValue,
  "dateFrom" | "dateTo" | "status"
>;

/**
 * Props for Employee Attendance History component.
 */
export interface EmployeeAttendanceHistoryProps {
  employeeId: string;
  employeeName?: string;
  departmentName?: string;
  records: AttendanceRow[];
  totals?: AttendanceTotals | null;
  filteredTotal?: number | null;
  filter: EmployeeAttendanceHistoryFilter;
  onFilterChange: (filter: EmployeeAttendanceHistoryFilter) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: Error | { message: string } | null;
  isForbidden?: boolean;
  onRetry?: () => void;
  canOverride?: boolean;
  onOverrideClick?: (record: AttendanceRow) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}
