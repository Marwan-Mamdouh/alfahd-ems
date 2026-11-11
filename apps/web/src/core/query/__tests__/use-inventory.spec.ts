import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/axios-instance";
import { queryKeys } from "../query-keys";
import {
  fetchInventoryStock,
  fetchWarehouseStock,
  recordInboundStock,
  transferStock,
  adjustStock,
} from "@/core/api/inventory";
import { extractErrorMessage } from "../use-inventory";
import type {
  WarehouseInventoryDto,
  StockMovementDto,
} from "@/core/api/types";

describe("Inventory React Query Integration", () => {
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

  const mockStock: WarehouseInventoryDto = {
    id: "stock-1",
    warehouseId: "wh-1",
    productId: "prod-1",
    quantity: 100,
    updatedAt: "2026-01-01T00:00:00Z",
    product: {
      id: "prod-1",
      name: "Fiber Optic Drop Cable",
      sku: "CAB-FO-100",
      model: "Standard",
      category: "Cables",
      lowStockThreshold: 20,
      isSerialized: false,
    },
    warehouse: {
      id: "wh-1",
      name: "Alexandria Depot",
    },
  };

  const mockMovement: StockMovementDto = {
    id: "mov-1",
    productId: "prod-1",
    warehouseId: "wh-1",
    movementType: "INBOUND_SUPPLIER",
    quantity: 50,
    supplierName: "El Sewedy",
    technicianId: null,
    responsibleUserId: "user-1",
    notes: "Batch delivery",
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("fetches and caches global inventory balances", async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: { items: [mockStock], total: 1 } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.inventory.balances();
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchInventoryStock(),
    });

    expect(result.items).toEqual([mockStock]);
    expect(queryClient.getQueryData(key)).toEqual(result);
  });

  it("fetches and caches warehouse-specific stock balances", async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: { items: [mockStock], total: 1 } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.inventory.warehouseStock("wh-1");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchWarehouseStock("wh-1"),
    });

    expect(result.items).toEqual([mockStock]);
    expect(queryClient.getQueryData(key)).toEqual(result);
  });

  it("fetches movements and checks cache invalidation on inbound mutation", async () => {
    const invKey = queryKeys.inventory.all;
    const whKey = queryKeys.warehouses.all;
    const prodKey = queryKeys.products.all;

    queryClient.setQueryData(invKey, { items: [mockStock] });
    queryClient.setQueryData(whKey, { items: [] });
    queryClient.setQueryData(prodKey, { items: [] });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: { inventory: mockStock, movement: mockMovement } },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    await recordInboundStock({
      warehouseId: "wh-1",
      productId: "prod-1",
      quantity: 50,
      supplierName: "El Sewedy",
    });

    // Mimic useRecordInbound onSuccess invalidation
    await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

    expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(whKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(prodKey)?.isInvalidated).toBe(true);
  });

  it("invalidates inventory and related caches on transfer and adjustment", async () => {
    const invKey = queryKeys.inventory.all;
    const whKey = queryKeys.warehouses.all;
    const prodKey = queryKeys.products.all;

    queryClient.setQueryData(invKey, { items: [mockStock] });
    queryClient.setQueryData(whKey, { items: [] });
    queryClient.setQueryData(prodKey, { items: [] });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: {
          data: {
            sourceInventory: mockStock,
            destInventory: { ...mockStock, warehouseId: "wh-2" },
            inventory: mockStock,
            movement: mockMovement,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await transferStock({
      fromWarehouseId: "wh-1",
      toWarehouseId: "wh-2",
      productId: "prod-1",
      quantity: 10,
    });

    await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);

    await adjustStock({
      warehouseId: "wh-1",
      productId: "prod-1",
      newQuantity: 120,
      notes: "Audit correction",
    });

    await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

    expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(whKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(prodKey)?.isInvalidated).toBe(true);
  });

  describe("extractErrorMessage helper", () => {
    it("extracts single message from axios-like error", () => {
      const err = {
        isAxiosError: true,
        response: {
          data: {
            message: "Insufficient stock: available 5, requested 10",
          },
        },
      };
      expect(extractErrorMessage(err, "Fallback")).toBe("Insufficient stock: available 5, requested 10");
    });

    it("joins array messages from validation pipe", () => {
      const err = {
        isAxiosError: true,
        response: {
          data: {
            message: ["Mandatory justification notes required", "Target quantity cannot be negative"],
          },
        },
      };
      expect(extractErrorMessage(err, "Fallback")).toBe(
        "Mandatory justification notes required, Target quantity cannot be negative"
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
