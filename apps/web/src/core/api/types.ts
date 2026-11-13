/**
 * Wire-format types for the API.
 *
 * Domain enums, value constants, and DTO contracts are re-exported directly from
 * `@alfahd/types` — the single source of truth for the API contract (Constitution §I).
 */
export * from "@alfahd/types";

/**
 * Success envelope. The backend's `ResponseInterceptor` wraps every response
 * as `{ data: <payload> }` — there is no `success` flag and no `message` field.
 */
export interface ApiResponse<T> {
  data: T;
}

/** Error envelope returned with every non-2xx response. */
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
}

/**
 * Common list query parameters across paginated/filterable endpoints.
 */
export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | number | boolean | undefined>;
}

/**
 * Unified pagination result across all domains (unifies HR `{ data, meta }`,
 * supply `{ items, total }`, and client-paginated arrays).
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
