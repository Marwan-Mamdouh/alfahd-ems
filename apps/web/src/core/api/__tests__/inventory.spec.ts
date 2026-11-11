import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "../axios-instance";
import {
  fetchWarehouseStock,
  fetchInventoryStock,
  fetchWarehouseMovements,
} from "../inventory";
import type { WarehouseInventoryDto, StockMovementDto } from "../types";

describe("Inventory API Client Functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockStock: WarehouseInventoryDto = {
    id: "stock-1",
    warehouseId: "wh-1",
    productId: "prod-1",
    quantity: 45,
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const mockMovement: StockMovementDto = {
    id: "mov-1",
    productId: "prod-1",
    warehouseId: "wh-1",
    movementType: "INBOUND_SUPPLIER",
    quantity: 20,
    supplierName: "Acme Telco",
    technicianId: null,
    responsibleUserId: "user-1",
    notes: "Initial delivery",
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("fetchWarehouseStock queries /inventory/warehouses/:id", async () => {
    let capturedUrl = "";

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      return {
        data: {
          data: {
            items: [mockStock],
            total: 1,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchWarehouseStock("wh-1");
    expect(capturedUrl).toBe("/inventory/warehouses/wh-1");
    expect(result.items).toEqual([mockStock]);
    expect(result.total).toBe(1);
  });

  it("fetchInventoryStock queries /inventory", async () => {
    let capturedUrl = "";

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      return {
        data: {
          data: {
            items: [mockStock],
            total: 1,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchInventoryStock();
    expect(capturedUrl).toBe("/inventory");
    expect(result.items).toEqual([mockStock]);
  });

  it("fetchWarehouseMovements queries /inventory/movements with params", async () => {
    let capturedUrl = "";
    let capturedParams: Record<string, unknown> = {};

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedParams = (config.params as Record<string, unknown>) ?? {};
      return {
        data: {
          data: {
            items: [mockMovement],
            total: 1,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchWarehouseMovements({ warehouseId: "wh-1", limit: 10 });
    expect(capturedUrl).toBe("/inventory/movements");
    expect(capturedParams).toEqual({ warehouseId: "wh-1", limit: 10 });
    expect(result.items).toEqual([mockMovement]);
  });
});

