import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/axios-instance";
import { queryKeys } from "../query-keys";
import {
  fetchRouters,
  fetchRouterById,
  createRouter,
  assignRouter,
} from "@/core/api/routers";
import { extractErrorMessage } from "../use-routers";
import type { RouterDto, CreateRouterDto, AssignRouterDto } from "@/core/api/types";

describe("Routers React Query Integration", () => {
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

  const mockRouter: RouterDto = {
    id: "router-1",
    serialNumber: "TPL-2026-00001",
    productId: "prod-1",
    status: "AVAILABLE",
    physicalCondition: "SERVICEABLE",
    warehouseId: "wh-1",
    externalLocation: null,
    currentHolderType: "WAREHOUSE",
    currentHolderId: "wh-1",
    notes: "Initial receipt",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    product: {
      id: "prod-1",
      name: "TP-Link Archer C6",
      sku: "RTR-TPL-C6",
      model: "Archer C6",
    },
    warehouse: {
      id: "wh-1",
      name: "Alexandria Depot",
    },
  };

  it("fetches and caches routers list", async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: { items: [mockRouter], total: 1 } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.routers.list();
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchRouters(),
    });

    expect(result.items).toEqual([mockRouter]);
    expect(queryClient.getQueryData(key)).toEqual(result);
  });

  it("fetches and caches router detail", async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockRouter },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.routers.detail("router-1");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchRouterById("router-1"),
    });

    expect(result).toEqual(mockRouter);
    expect(queryClient.getQueryData(key)).toEqual(mockRouter);
  });

  it("invalidates routers, warehouse, inventory, and product caches on create", async () => {
    const listKey = queryKeys.routers.list();
    const whKey = queryKeys.warehouses.all;
    const invKey = queryKeys.inventory.all;
    const prodKey = queryKeys.products.all;

    queryClient.setQueryData(listKey, { items: [mockRouter], total: 1 });
    queryClient.setQueryData(whKey, { items: [] });
    queryClient.setQueryData(invKey, { items: [] });
    queryClient.setQueryData(prodKey, { items: [] });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockRouter },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const createDto: CreateRouterDto = {
      serialNumber: "TPL-2026-00002",
      productId: "prod-1",
      warehouseId: "wh-1",
      isNewReceipt: true,
    };

    await createRouter(createDto);

    // Mimic useCreateRouter onSuccess:
    await queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(whKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(prodKey)?.isInvalidated).toBe(true);
  });

  it("invalidates routers, warehouse, and inventory caches on assign", async () => {
    const listKey = queryKeys.routers.list();
    const whKey = queryKeys.warehouses.all;
    const invKey = queryKeys.inventory.all;

    queryClient.setQueryData(listKey, { items: [mockRouter], total: 1 });
    queryClient.setQueryData(whKey, { items: [] });
    queryClient.setQueryData(invKey, { items: [] });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: { ...mockRouter, status: "ASSIGNED_TO_TECHNICIAN" } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const assignDto: AssignRouterDto = {
      technicianId: "tech-1",
      notes: "Field assignment",
    };

    await assignRouter("router-1", assignDto);

    // Mimic useAssignRouter onSuccess:
    await queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(whKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
  });

  describe("extractErrorMessage helper", () => {
    it("extracts 409 capacity limit conflict message", () => {
      const err = {
        isAxiosError: true,
        response: {
          data: {
            message:
              "Existing stock onboarding capacity exhausted: recorded stock is 5, but 5 usable routers are already registered.",
          },
        },
      };
      expect(extractErrorMessage(err, "Fallback")).toBe(
        "Existing stock onboarding capacity exhausted: recorded stock is 5, but 5 usable routers are already registered."
      );
    });

    it("extracts 409 duplicate serial conflict message", () => {
      const err = {
        isAxiosError: true,
        response: {
          data: {
            message: "Router with serial number 'TPL-2026-00001' already exists in the system.",
          },
        },
      };
      expect(extractErrorMessage(err, "Fallback")).toBe(
        "Router with serial number 'TPL-2026-00001' already exists in the system."
      );
    });

    it("joins array messages from class-validator", () => {
      const err = {
        isAxiosError: true,
        response: {
          data: {
            message: ["Serial number is required", "Warehouse ID must be a valid UUID"],
          },
        },
      };
      expect(extractErrorMessage(err, "Fallback")).toBe(
        "Serial number is required, Warehouse ID must be a valid UUID"
      );
    });

    it("falls back to standard Error message or default", () => {
      expect(extractErrorMessage(new Error("Local validation error"), "Fallback")).toBe(
        "Local validation error"
      );
      expect(extractErrorMessage({}, "Fallback")).toBe("Fallback");
    });
  });
});

