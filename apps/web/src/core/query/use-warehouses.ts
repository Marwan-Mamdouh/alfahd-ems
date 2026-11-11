"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { queryKeys } from "@/core/query/query-keys";
import {
  fetchWarehouses,
  fetchWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "@/core/api/warehouses";
import { fetchWarehouseStock, fetchWarehouseMovements } from "@/core/api/inventory";
import { useEmployeeLookup } from "@/core/query/use-employee-lookup";
import { Role } from "@alfahd/types";
import type {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  QueryWarehousesDto,
  QueryInventoryDto,
  QueryStockMovementsDto,
} from "@/core/api/types";

export interface UseWarehousesOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch paginated warehouses.
 */
export function useWarehouses(
  params?: QueryWarehousesDto,
  options?: UseWarehousesOptions
) {
  const query = useQuery({
    queryKey: queryKeys.warehouses.list(params),
    queryFn: () => fetchWarehouses(params),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    warehouses: query.data?.items ?? [],
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
 * Hook to fetch a single warehouse by ID.
 */
export function useWarehouse(id?: string, options?: UseWarehousesOptions) {
  const query = useQuery({
    queryKey: id ? queryKeys.warehouses.detail(id) : queryKeys.warehouses.details(),
    queryFn: () => fetchWarehouseById(id!),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 30_000,
  });

  return {
    warehouse: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Mutation hook to create a warehouse.
 * Invalidates warehouse lists and inventory stock balances.
 */
export function useCreateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateWarehouseDto) => createWarehouse(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Mutation hook to update an existing warehouse.
 */
export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateWarehouseDto }) =>
      updateWarehouse(id, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.warehouses.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Mutation hook to soft-deactivate a warehouse.
 * Handles 409 Conflict gracefully by extracting the exact backend blocker reason
 * (e.g. active inventory, assigned staff, located routers, active custody).
 */
export function useDeleteWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Extracts a user-facing error message from an API error (specifically for 409 Conflict blockers).
 */
export function extractErrorMessage(err: unknown, defaultMessage: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(", ") : data.message;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return defaultMessage;
}

/**
 * Hook to fetch staff assigned to a specific warehouse via real /employees/lookup.
 * Enforces least-privilege network scoping: only enabled for ADMIN and WAREHOUSE_STAFF.
 */
export function useWarehouseStaff(
  warehouseId?: string,
  userRole?: Role | null,
  options?: UseWarehousesOptions
) {
  const isAuthorized =
    userRole === Role.ADMIN || userRole === Role.WAREHOUSE_STAFF;

  const result = useEmployeeLookup(
    warehouseId ? { warehouse_id: warehouseId } : undefined,
    { enabled: (options?.enabled ?? true) && isAuthorized && Boolean(warehouseId) }
  );

  return {
    ...result,
    isLoading: isAuthorized && result.isLoading,
    isError: isAuthorized && result.isError,
    error: isAuthorized ? result.error : null,
    isForbidden: !isAuthorized,
  };
}

/**
 * Hook to fetch real inventory stock balances in a warehouse.
 */
export function useWarehouseStock(
  warehouseId?: string,
  params?: QueryInventoryDto,
  options?: UseWarehousesOptions
) {
  const query = useQuery({
    queryKey: warehouseId
      ? queryKeys.warehouses.stock(warehouseId)
      : queryKeys.warehouses.all,
    queryFn: () => fetchWarehouseStock(warehouseId!, params),
    enabled: (options?.enabled ?? true) && Boolean(warehouseId),
    staleTime: 30_000,
  });

  return {
    stockItems: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch stock movements for a warehouse.
 * Enforces least-privilege network scoping: only enabled for ADMIN and WAREHOUSE_STAFF.
 */
export function useWarehouseMovements(
  warehouseId?: string,
  userRole?: Role | null,
  params?: QueryStockMovementsDto,
  options?: UseWarehousesOptions
) {
  const isAuthorized =
    userRole === Role.ADMIN || userRole === Role.WAREHOUSE_STAFF;

  const query = useQuery({
    queryKey: warehouseId
      ? queryKeys.inventory.movements({ warehouseId, ...params })
      : queryKeys.inventory.all,
    queryFn: () => fetchWarehouseMovements({ warehouseId, ...params }),
    enabled: (options?.enabled ?? true) && isAuthorized && Boolean(warehouseId),
    staleTime: 30_000,
  });

  return {
    movements: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: isAuthorized && query.isLoading,
    isError: isAuthorized && query.isError,
    error: isAuthorized && query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
    isForbidden: !isAuthorized,
  };
}

