import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import { normalizePaginatedResponse } from "@/core/api/pagination";
import type {
  WarehouseDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  QueryWarehousesDto,
  PaginatedResult,
} from "@/core/api/types";

/**
 * Fetch paginated warehouses list with optional search and bounds.
 */
export async function fetchWarehouses(
  params?: QueryWarehousesDto
): Promise<PaginatedResult<WarehouseDto>> {
  const response = await api.get<{ data: { items: WarehouseDto[]; total: number } }>(
    ENDPOINTS.warehouses.list,
    { params }
  );
  const data = unwrap(response);
  const page =
    params?.offset !== undefined && params?.limit
      ? Math.floor(params.offset / params.limit) + 1
      : 1;
  const pageSize = params?.limit ?? 20;
  return normalizePaginatedResponse<WarehouseDto>(data, page, pageSize);
}

/**
 * Fetch a single warehouse by ID.
 */
export async function fetchWarehouseById(id: string): Promise<WarehouseDto> {
  const response = await api.get<{ data: WarehouseDto }>(
    ENDPOINTS.warehouses.byId(id)
  );
  return unwrap(response);
}

/**
 * Create a new warehouse (ADMIN only).
 */
export async function createWarehouse(
  dto: CreateWarehouseDto
): Promise<WarehouseDto> {
  const response = await api.post<{ data: WarehouseDto }>(
    ENDPOINTS.warehouses.create,
    dto
  );
  return unwrap(response);
}

/**
 * Update an existing warehouse (ADMIN only).
 */
export async function updateWarehouse(
  id: string,
  dto: UpdateWarehouseDto
): Promise<WarehouseDto> {
  const response = await api.patch<{ data: WarehouseDto }>(
    ENDPOINTS.warehouses.update(id),
    dto
  );
  return unwrap(response);
}

/**
 * Soft-deactivate a warehouse (ADMIN only).
 * If the warehouse has active inventory, staff, or located routers, the backend returns 409 Conflict.
 */
export async function deleteWarehouse(id: string): Promise<void> {
  await api.delete(ENDPOINTS.warehouses.remove(id));
}

