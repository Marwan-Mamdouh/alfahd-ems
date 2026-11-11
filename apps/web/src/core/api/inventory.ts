import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import { normalizePaginatedResponse } from "@/core/api/pagination";
import type {
  WarehouseInventoryDto,
  StockMovementDto,
  QueryInventoryDto,
  QueryStockMovementsDto,
  PaginatedResult,
} from "@/core/api/types";

/**
 * Fetch inventory stock balances for a specific warehouse.
 */
export async function fetchWarehouseStock(
  warehouseId: string,
  params?: QueryInventoryDto
): Promise<PaginatedResult<WarehouseInventoryDto>> {
  const response = await api.get<{
    data: { items: WarehouseInventoryDto[]; total: number };
  }>(ENDPOINTS.inventory.warehouseStock(warehouseId), { params });
  const data = unwrap(response);
  const page =
    params?.offset !== undefined && params?.limit
      ? Math.floor(params.offset / params.limit) + 1
      : 1;
  const pageSize = params?.limit ?? 20;
  return normalizePaginatedResponse<WarehouseInventoryDto>(data, page, pageSize);
}

/**
 * Fetch overall inventory stock balances across all warehouses.
 */
export async function fetchInventoryStock(
  params?: QueryInventoryDto
): Promise<PaginatedResult<WarehouseInventoryDto>> {
  const response = await api.get<{
    data: { items: WarehouseInventoryDto[]; total: number };
  }>(ENDPOINTS.inventory.stock, { params });
  const data = unwrap(response);
  const page =
    params?.offset !== undefined && params?.limit
      ? Math.floor(params.offset / params.limit) + 1
      : 1;
  const pageSize = params?.limit ?? 20;
  return normalizePaginatedResponse<WarehouseInventoryDto>(data, page, pageSize);
}

/**
 * Fetch stock movements audit log (ADMIN, WAREHOUSE_STAFF only).
 */
export async function fetchWarehouseMovements(
  params?: QueryStockMovementsDto
): Promise<PaginatedResult<StockMovementDto>> {
  const response = await api.get<{
    data: { items: StockMovementDto[]; total: number };
  }>(ENDPOINTS.inventory.movements, { params });
  const data = unwrap(response);
  const page =
    params?.offset !== undefined && params?.limit
      ? Math.floor(params.offset / params.limit) + 1
      : 1;
  const pageSize = params?.limit ?? 20;
  return normalizePaginatedResponse<StockMovementDto>(data, page, pageSize);
}

