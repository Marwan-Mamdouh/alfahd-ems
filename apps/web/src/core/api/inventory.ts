import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import { normalizePaginatedResponse } from "@/core/api/pagination";
import type {
  WarehouseInventoryDto,
  StockMovementDto,
  InboundStockDto,
  OutboundStockDto,
  ReturnStockDto,
  TransferStockDto,
  AdjustStockDto,
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

/**
 * Record an inbound stock receipt from a supplier (ADMIN, WAREHOUSE_STAFF).
 */
export async function recordInboundStock(
  dto: InboundStockDto
): Promise<{ inventory: WarehouseInventoryDto; movement: StockMovementDto }> {
  const response = await api.post<{
    data: { inventory: WarehouseInventoryDto; movement: StockMovementDto };
  }>(ENDPOINTS.inventory.inbound, dto);
  return unwrap(response);
}

/**
 * Issue outbound stock to a technician (ADMIN, WAREHOUSE_STAFF).
 */
export async function recordOutboundStock(
  dto: OutboundStockDto
): Promise<{ inventory: WarehouseInventoryDto; movement: StockMovementDto }> {
  const response = await api.post<{
    data: { inventory: WarehouseInventoryDto; movement: StockMovementDto };
  }>(ENDPOINTS.inventory.outbound, dto);
  return unwrap(response);
}

/**
 * Receive returned stock from a technician (ADMIN, WAREHOUSE_STAFF).
 */
export async function recordReturnStock(
  dto: ReturnStockDto
): Promise<{ inventory: WarehouseInventoryDto; movement: StockMovementDto }> {
  const response = await api.post<{
    data: { inventory: WarehouseInventoryDto; movement: StockMovementDto };
  }>(ENDPOINTS.inventory.returns, dto);
  return unwrap(response);
}

/**
 * Transfer stock between two distinct warehouses (ADMIN, WAREHOUSE_STAFF).
 */
export async function transferStock(
  dto: TransferStockDto
): Promise<{
  sourceInventory: WarehouseInventoryDto;
  destInventory: WarehouseInventoryDto;
}> {
  const payload: TransferStockDto = {
    productId: dto.productId,
    fromWarehouseId: dto.fromWarehouseId,
    toWarehouseId: dto.toWarehouseId,
    quantity: dto.quantity,
    notes: dto.notes,
  };
  const response = await api.post<{
    data: {
      sourceInventory: WarehouseInventoryDto;
      destInventory: WarehouseInventoryDto;
    };
  }>(ENDPOINTS.inventory.transfer, payload);
  return unwrap(response);
}

/**
 * Perform an inventory reconciliation/adjustment (ADMIN only).
 */
export async function adjustStock(
  dto: AdjustStockDto
): Promise<{ inventory: WarehouseInventoryDto; movement: StockMovementDto }> {
  const payload: AdjustStockDto = {
    productId: dto.productId,
    warehouseId: dto.warehouseId,
    newQuantity: dto.newQuantity,
    notes: dto.notes,
  };
  const response = await api.post<{
    data: { inventory: WarehouseInventoryDto; movement: StockMovementDto };
  }>(ENDPOINTS.inventory.adjust, payload);
  return unwrap(response);
}

