import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import { normalizePaginatedResponse } from "@/core/api/pagination";
import { queryKeys } from "../query-keys";
import type { WarehouseDto, PaginatedResult } from "@/core/api/types";

describe("React Query Client & Container Seam Smoke Test", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 5_000,
        },
      },
    });
  });

  it("fetches and normalizes data through query adapter seam", async () => {
    const mockWarehouse: WarehouseDto = {
      id: "wh-smoke-1",
      name: "Main Distribution Center",
      address: "10 Industrial Zone, 6th of October",
      latitude: 29.97,
      longitude: 30.95,
      geofenceRadiusMeters: 200,
      managerId: null,
      isActive: true,
      createdAt: "2026-11-10T00:00:00.000Z",
      updatedAt: "2026-11-10T00:00:00.000Z",
    };

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: {
          data: {
            items: [mockWarehouse],
            total: 1,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    // Container / hook query function
    const fetchWarehouseList = async (page = 1, pageSize = 20): Promise<PaginatedResult<WarehouseDto>> => {
      const response = await api.get(ENDPOINTS.warehouses.list, {
        params: { limit: pageSize, offset: (page - 1) * pageSize },
      });
      const payload = unwrap<{ items: WarehouseDto[]; total: number }>(response);
      return normalizePaginatedResponse<WarehouseDto>(payload, page, pageSize);
    };

    const queryKey = queryKeys.warehouses.list({ limit: 20, offset: 0 });

    const result = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchWarehouseList(1, 20),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Main Distribution Center");
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);

    // Verify cache state
    const cached = queryClient.getQueryData<PaginatedResult<WarehouseDto>>(queryKey);
    expect(cached).toEqual(result);
  });

  it("invalidates hierarchical keys across the domain on mutation", async () => {
    const listKey = queryKeys.warehouses.list({ limit: 10 });
    const detailKey = queryKeys.warehouses.detail("wh-smoke-1");

    // Populate cache with dummy data
    queryClient.setQueryData(listKey, { items: [], total: 0 });
    queryClient.setQueryData(detailKey, { id: "wh-smoke-1", name: "Old Name" });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(false);

    // Broad domain invalidation (e.g. after adding a warehouse or deactivating)
    await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });

    // Both list and detail should now be invalidated
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
  });
});

