"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/query/query-keys";
import {
  fetchIpAddresses,
  fetchIpAddressById,
  createIpAddress,
  updateIpAddress,
  reserveIpAddress,
  releaseIpAddress,
  archiveIpAddress,
  unarchiveIpAddress,
  fetchIpHistory,
} from "@/core/api/ip-addresses";
import type {
  CreateIpDto,
  UpdateIpDto,
  IpQueryDto,
} from "@/core/api/types";

export interface UseIpAddressesOptions {
  enabled?: boolean;
}

/**
 * User-facing error message extractor re-exported from @/core/api/errors.
 */
export { extractErrorMessage } from "@/core/api/errors";

/**
 * Hook to fetch paginated IPv4 addresses with optional filtering (status, isArchived, search).
 * Supported by ADMIN and TECHNICIAN roles.
 */
export function useIpAddresses(
  params?: IpQueryDto,
  options?: UseIpAddressesOptions
) {
  const query = useQuery({
    queryKey: queryKeys.ipAddresses.list(params),
    queryFn: () => fetchIpAddresses(params),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    ipAddresses: query.data?.items ?? [],
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
 * Hook to fetch a single IP address by UUID.
 * Supported by ADMIN and TECHNICIAN roles.
 */
export function useIpAddress(id?: string, options?: UseIpAddressesOptions) {
  const query = useQuery({
    queryKey: id ? queryKeys.ipAddresses.detail(id) : queryKeys.ipAddresses.details(),
    queryFn: () => fetchIpAddressById(id!),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 30_000,
  });

  return {
    ipAddress: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Mutation hook to register a new individual IPv4 address in FREE status.
 * Invalidate all IP address queries.
 * ADMIN role only.
 */
export function useCreateIpAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateIpDto) => createIpAddress(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
    },
  });
}

/**
 * Mutation hook to update metadata notes on an IP address.
 * Invalidates lists, detail record, and history.
 * ADMIN role only.
 */
export function useUpdateIpAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateIpDto }) =>
      updateIpAddress(id, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(variables.id) });
    },
  });
}

/**
 * Mutation hook to manually reserve an available FREE IP address.
 * Invalidates lists, detail record, and history.
 * ADMIN role only.
 */
export function useReserveIpAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      reserveIpAddress(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(variables.id) });
    },
  });
}

/**
 * Mutation hook to release a RESERVED IP address back to FREE.
 * Invalidates lists, detail record, and history.
 * ADMIN role only.
 */
export function useReleaseIpAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      releaseIpAddress(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(variables.id) });
    },
  });
}

/**
 * Mutation hook to archive a FREE IP address.
 * Throws 409 Conflict if RESERVED.
 * Invalidates lists, detail record, and history.
 * ADMIN role only.
 */
export function useArchiveIpAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      archiveIpAddress(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(variables.id) });
    },
  });
}

/**
 * Mutation hook to unarchive an archived IP address back to active pool.
 * Invalidates lists, detail record, and history.
 * ADMIN role only.
 */
export function useUnarchiveIpAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      unarchiveIpAddress(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.history(variables.id) });
    },
  });
}

/**
 * Hook to fetch the full mutation audit history for an IP address.
 * Strictly ADMIN role only.
 */
export function useIpHistory(id?: string, options?: UseIpAddressesOptions) {
  const query = useQuery({
    queryKey: id ? queryKeys.ipAddresses.history(id) : queryKeys.ipAddresses.details(),
    queryFn: () => fetchIpHistory(id!),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 30_000,
  });

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

