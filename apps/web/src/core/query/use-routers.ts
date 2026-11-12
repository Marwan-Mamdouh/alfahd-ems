"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/query/query-keys";
import {
  fetchRouters,
  fetchRouterById,
  createRouter,
  assignRouter,
  transitionRouter,
  updateRouterCondition,
  fetchRouterAssignments,
  fetchRouterConditionHistory,
  fetchRouterStatusHistory,
} from "@/core/api/routers";
import type {
  CreateRouterDto,
  AssignRouterDto,
  TransitionRouterDto,
  UpdateRouterConditionDto,
  RouterQueryDto,
} from "@/core/api/types";

export interface UseRoutersOptions {
  enabled?: boolean;
}

/**
 * User-facing error message extractor re-exported from @/core/api/errors.
 */
export { extractErrorMessage } from "@/core/api/errors";

/**
 * Hook to fetch paginated routers with optional filtering.
 */
export function useRouters(
  params?: RouterQueryDto,
  options?: UseRoutersOptions
) {
  const query = useQuery({
    queryKey: queryKeys.routers.list(params),
    queryFn: () => fetchRouters(params),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    routers: query.data?.items ?? [],
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
 * Hook to fetch a single router by ID.
 */
export function useRouter(id?: string, options?: UseRoutersOptions) {
  const query = useQuery({
    queryKey: id ? queryKeys.routers.detail(id) : queryKeys.routers.details(),
    queryFn: () => fetchRouterById(id!),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 30_000,
  });

  return {
    router: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Mutation hook to register / onboard a router asset (ADMIN, WAREHOUSE_STAFF).
 * Supports dual onboarding modes: isNewReceipt: true (+1 stock) vs false (+0 stock, capacity check).
 * Automatically invalidates router lists, warehouse stock, inventory balances, and products.
 */
export function useCreateRouter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateRouterDto) => createRouter(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

/**
 * Mutation hook to assign an available router to a technician (ADMIN, WAREHOUSE_STAFF).
 * Decrements warehouse inventory (-1 OUTBOUND_TECHNICIAN) and records custody.
 */
export function useAssignRouter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AssignRouterDto }) =>
      assignRouter(id, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Mutation hook to transition router status along the approved whitelist (ADMIN, WAREHOUSE_STAFF).
 */
export function useTransitionRouter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: TransitionRouterDto }) =>
      transitionRouter(id, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.statusHistory(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.assignmentHistory(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Mutation hook to update hardware condition and location context (ADMIN, WAREHOUSE_STAFF).
 */
export function useUpdateRouterCondition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateRouterConditionDto }) =>
      updateRouterCondition(id, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.conditionHistory(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.assignmentHistory(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Hook to fetch custody assignment history for a router.
 */
export function useRouterAssignments(id?: string, options?: UseRoutersOptions) {
  const query = useQuery({
    queryKey: id ? queryKeys.routers.assignmentHistory(id) : queryKeys.routers.details(),
    queryFn: () => fetchRouterAssignments(id!),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 30_000,
  });

  return {
    assignments: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch physical condition history for a router.
 */
export function useRouterConditionHistory(id?: string, options?: UseRoutersOptions) {
  const query = useQuery({
    queryKey: id ? queryKeys.routers.conditionHistory(id) : queryKeys.routers.details(),
    queryFn: () => fetchRouterConditionHistory(id!),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 30_000,
  });

  return {
    conditionHistory: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch lifecycle status transition history for a router.
 */
export function useRouterStatusHistory(id?: string, options?: UseRoutersOptions) {
  const query = useQuery({
    queryKey: id ? queryKeys.routers.statusHistory(id) : queryKeys.routers.details(),
    queryFn: () => fetchRouterStatusHistory(id!),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 30_000,
  });

  return {
    statusHistory: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

