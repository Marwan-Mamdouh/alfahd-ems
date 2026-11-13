"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/query/query-keys";
import {
  fetchInventoryStock,
  fetchWarehouseStock,
  fetchWarehouseMovements,
  recordInboundStock,
  recordOutboundStock,
  recordReturnStock,
  transferStock,
  adjustStock,
} from "@/core/api/inventory";
import { Role } from "@alfahd/types";
import type {
  InboundStockDto,
  OutboundStockDto,
  ReturnStockDto,
  TransferStockDto,
  AdjustStockDto,
  QueryInventoryDto,
  QueryStockMovementsDto,
} from "@/core/api/types";

export interface UseInventoryOptions {
  enabled?: boolean;
}

/**
 * User-facing error message extractor re-exported from @/core/api/errors.
 */
export { extractErrorMessage } from "@/core/api/errors";

/**
 * Hook to fetch paginated inventory stock balances across all warehouses.
 */
export function useInventoryStock(
  params?: QueryInventoryDto,
  options?: UseInventoryOptions
) {
  const query = useQuery({
    queryKey: queryKeys.inventory.balances(params as Record<string, unknown>),
    queryFn: () => fetchInventoryStock(params),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    stockItems: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? 1,
    pageSize: query.data?.pageSize ?? 20,
    totalPages: query.data?.totalPages ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch inventory stock balances for a specific warehouse.
 */
export function useWarehouseInventoryStock(
  warehouseId?: string,
  params?: QueryInventoryDto,
  options?: UseInventoryOptions
) {
  const query = useQuery({
    queryKey: warehouseId
      ? queryKeys.inventory.warehouseStock(warehouseId)
      : queryKeys.inventory.all,
    queryFn: () => fetchWarehouseStock(warehouseId!, params),
    enabled: (options?.enabled ?? true) && Boolean(warehouseId),
    staleTime: 30_000,
  });

  return {
    data: query.data,
    stockItems: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? 1,
    pageSize: query.data?.pageSize ?? 20,
    totalPages: query.data?.totalPages ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch stock movements.
 * Enforces least-privilege network scoping: only enabled for ADMIN and WAREHOUSE_STAFF.
 * Read-only roles (e.g. CS, TECHNICIAN) are denied at client-level without sending HTTP requests.
 */
export function useInventoryMovements(
  params?: QueryStockMovementsDto,
  userRole?: Role | null,
  options?: UseInventoryOptions
) {
  const isAuthorized =
    userRole === Role.ADMIN || userRole === Role.WAREHOUSE_STAFF;

  const query = useQuery({
    queryKey: queryKeys.inventory.movements(params as Record<string, unknown>),
    queryFn: () => fetchWarehouseMovements(params),
    enabled: (options?.enabled ?? true) && isAuthorized,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    movements: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? 1,
    pageSize: query.data?.pageSize ?? 20,
    totalPages: query.data?.totalPages ?? 0,
    isLoading: isAuthorized && query.isLoading,
    isError: isAuthorized && query.isError,
    error: isAuthorized && query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
    isForbidden: !isAuthorized,
  };
}

/**
 * Shared helper to invalidate inventory balances, movements, warehouse lists, and products
 * following any stock mutation. Preserves non-awaited invocation behavior.
 */
function invalidateStockQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
}

/**
 * Mutation hook to record inbound stock from a supplier (ADMIN, WAREHOUSE_STAFF).
 * Automatically invalidates inventory balances, movements, warehouse lists, and products.
 */
export function useRecordInbound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: InboundStockDto) => recordInboundStock(dto),
    onSuccess: () => invalidateStockQueries(queryClient),
  });
}

/**
 * Mutation hook to issue outbound stock to a technician (ADMIN, WAREHOUSE_STAFF).
 */
export function useRecordOutbound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: OutboundStockDto) => recordOutboundStock(dto),
    onSuccess: () => invalidateStockQueries(queryClient),
  });
}

/**
 * Mutation hook to receive returned stock from a technician (ADMIN, WAREHOUSE_STAFF).
 */
export function useRecordReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ReturnStockDto) => recordReturnStock(dto),
    onSuccess: () => invalidateStockQueries(queryClient),
  });
}

/**
 * Mutation hook to transfer stock between two distinct warehouses (ADMIN, WAREHOUSE_STAFF).
 */
export function useTransferStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: TransferStockDto) => transferStock(dto),
    onSuccess: () => invalidateStockQueries(queryClient),
  });
}

/**
 * Mutation hook to adjust stock balances with audit justification notes (ADMIN only).
 */
export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: AdjustStockDto) => adjustStock(dto),
    onSuccess: () => invalidateStockQueries(queryClient),
  });
}
