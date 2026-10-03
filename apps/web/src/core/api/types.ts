/**
 * Wire-format types for the API.
 *
 * `Role` and `UserDto` are re-exported from `@alfahd/types` — the single source
 * of truth for the backend contract (Constitution §I). They are NOT redefined
 * here. The local copies that used to live in this file contradicted the wire:
 * `Role` carried `"CUSTOMER_SERVICE"` instead of `"CS"`, and `AuthUser` declared
 * `name`, `department`, `warehouseId` and `status`, none of which the backend
 * ever sends. `UserDto` is `{ id, email, role, isActive, createdAt }`.
 */
export type { Role, UserDto } from "@alfahd/types";

/**
 * Success envelope. The backend's `ResponseInterceptor` wraps **every** response
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
 * `GET /users` takes no pagination parameters and returns the full array
 * (R10), so `PaginatedResponse` was deleted. Sorting and filtering happen
 * client-side.
 */
export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | number | boolean | undefined>;
}
