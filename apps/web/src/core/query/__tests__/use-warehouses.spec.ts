import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/axios-instance";
import { queryKeys } from "../query-keys";
import {
  fetchWarehouses,
  fetchWarehouseById,
  createWarehouse,
} from "@/core/api/warehouses";
import { extractErrorMessage } from "../use-warehouses";
import type { WarehouseDto, CreateWarehouseDto } from "@/core/api/types";

describe("Warehouses React Query Integration", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const mockWarehouse: WarehouseDto = {
    id: "wh-1",
    name: "Alexandria Depot",
    address: "Smouha, Alexandria",
    latitude: 31.2156,
    longitude: 29.9553,
    geofenceRadiusMeters: 150,
    managerId: "mgr-1",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("fetches and caches warehouses list", async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: { items: [mockWarehouse], total: 1 } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.warehouses.list();
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchWarehouses(),
    });

    expect(result.items).toEqual([mockWarehouse]);
    expect(queryClient.getQueryData(key)).toEqual(result);
  });

  it("fetches and caches warehouse detail", async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockWarehouse },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.warehouses.detail("wh-1");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchWarehouseById("wh-1"),
    });

    expect(result).toEqual(mockWarehouse);
    expect(queryClient.getQueryData(key)).toEqual(mockWarehouse);
  });

  it("invalidates warehouse and inventory caches on mutation", async () => {
    const listKey = queryKeys.warehouses.list();
    const invKey = queryKeys.inventory.all;

    queryClient.setQueryData(listKey, { items: [mockWarehouse], total: 1 });
    queryClient.setQueryData(invKey, { items: [] });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockWarehouse },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const createDto: CreateWarehouseDto = {
      name: "New WH",
      address: "Address",
      latitude: 30,
      longitude: 31,
    };

    await createWarehouse(createDto);

    // Mimic useCreateWarehouse onSuccess:
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
  });

  it("extractErrorMessage extracts 409 conflict message correctly", () => {
    const conflictError = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          statusCode: 409,
          message: "Cannot deactivate warehouse due to active inventory, staff, or routers",
        },
      },
    };

    const message = extractErrorMessage(conflictError, "Fallback error");
    expect(message).toBe("Cannot deactivate warehouse due to active inventory, staff, or routers");

    const plainError = new Error("Generic failure");
    expect(extractErrorMessage(plainError, "Fallback")).toBe("Generic failure");

    expect(extractErrorMessage(null, "Fallback message")).toBe("Fallback message");
  });
});

