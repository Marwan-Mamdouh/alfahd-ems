import type { PaginatedResult } from "./types";

interface LegacyPaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

/**
 * Normalizes different API response formats into a single unified `PaginatedResult<T>`.
 *
 * Supported formats:
 * 1. HR format: `{ data: T[], meta: { total, page, pageSize, totalPages } }`
 * 2. Supply / Inventory format: `{ items: T[], total: number }`
 * 3. Raw array format: `T[]` (e.g., non-paginated endpoints like users)
 * 4. Wrapped response formats where payload is wrapped in `{ data: ... }`
 * 5. Empty / null / invalid fallback
 */
export function normalizePaginatedResponse<T>(
  payload: unknown,
  fallbackPage = 1,
  fallbackPageSize = 20
): PaginatedResult<T> {
  const page = Math.max(1, fallbackPage || 1);
  const pageSize = Math.max(1, fallbackPageSize || 20);

  if (!payload || typeof payload !== "object") {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // Handle direct array payload
  if (Array.isArray(payload)) {
    const total = payload.length;
    return {
      items: payload as T[],
      total,
      page,
      pageSize,
      totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
    };
  }

  const obj = payload as Record<string, unknown>;

  // If response is wrapped in an outer `data` property that is an object (not an array)
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return normalizePaginatedResponse<T>(obj.data, page, pageSize);
  }

  // Format 1: HR format `{ data: T[], meta?: { ... } }`
  if (Array.isArray(obj.data)) {
    const items = obj.data as T[];
    const meta = (obj.meta ?? {}) as LegacyPaginationMeta;
    const total = typeof meta.total === "number" ? meta.total : items.length;
    const resolvedPage = typeof meta.page === "number" && meta.page > 0 ? meta.page : page;
    const resolvedPageSize =
      typeof meta.pageSize === "number" && meta.pageSize > 0 ? meta.pageSize : pageSize;
    const totalPages =
      typeof meta.totalPages === "number"
        ? meta.totalPages
        : total > 0
        ? Math.ceil(total / resolvedPageSize)
        : 0;

    return {
      items,
      total,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      totalPages,
    };
  }

  // Format 2: Supply format `{ items: T[], total: number }`
  if (Array.isArray(obj.items)) {
    const items = obj.items as T[];
    const total = typeof obj.total === "number" ? obj.total : items.length;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // Fallback for unexpected object shapes
  return {
    items: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
  };
}

