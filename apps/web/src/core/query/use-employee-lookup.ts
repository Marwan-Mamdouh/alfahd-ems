"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/core/query/query-keys";
import { fetchEmployeeLookup } from "@/core/api/employees";
import { Role } from "@alfahd/types";
import type { EmployeeLookupDto, EmployeeLookupQueryDto } from "@/core/api/types";

export interface UseEmployeeLookupOptions {
  enabled?: boolean;
}

/**
 * Hook for minimal employee lookup without PII (accessible by ADMIN and WAREHOUSE_STAFF).
 */
export function useEmployeeLookup(
  params?: EmployeeLookupQueryDto,
  options?: UseEmployeeLookupOptions
) {
  const query = useQuery<EmployeeLookupDto[]>({
    queryKey: queryKeys.employees.lookup(params),
    queryFn: () => fetchEmployeeLookup(params),
    enabled: options?.enabled ?? true,
    staleTime: 60_000, // 1 minute fresh cache
  });

  return {
    employees: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Specialized lookup hook for active technicians (optionally filtered by warehouse).
 * Ideal for router assignment and outbound stock movement forms.
 */
export function useTechniciansLookup(
  warehouseId?: string,
  options?: UseEmployeeLookupOptions
) {
  const params: EmployeeLookupQueryDto = {
    role: Role.TECHNICIAN,
    status: "ACTIVE",
    ...(warehouseId ? { warehouseId } : {}),
  };

  const lookup = useEmployeeLookup(params, options);

  return {
    technicians: lookup.employees,
    isLoading: lookup.isLoading,
    isError: lookup.isError,
    error: lookup.error,
    refetch: lookup.refetch,
  };
}

