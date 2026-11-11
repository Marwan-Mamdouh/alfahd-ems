import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "../axios-instance";
import {
  fetchWarehouseStock,
  fetchInventoryStock,
  fetchWarehouseMovements,
  recordInboundStock,
  recordOutboundStock,
  recordReturnStock,
  transferStock,
  adjustStock,
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

  it("recordInboundStock posts to /inventory/inbound", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: {
          data: { inventory: mockStock, movement: mockMovement },
        },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const dto = {
      warehouseId: "wh-1",
      productId: "prod-1",
      quantity: 15,
      supplierName: "Telecom Supply Co",
      notes: "Arrived today",
    };

    const result = await recordInboundStock(dto);
    expect(capturedUrl).toBe("/inventory/inbound");
    expect(capturedData).toEqual(dto);
    expect(result.inventory).toEqual(mockStock);
    expect(result.movement).toEqual(mockMovement);
  });

  it("recordOutboundStock posts to /inventory/outbound", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: {
          data: { inventory: mockStock, movement: mockMovement },
        },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const dto = {
      warehouseId: "wh-1",
      productId: "prod-1",
      quantity: 5,
      technicianId: "tech-1",
      notes: "Issued for fiber job",
    };

    const result = await recordOutboundStock(dto);
    expect(capturedUrl).toBe("/inventory/outbound");
    expect(capturedData).toEqual(dto);
    expect(result.inventory).toEqual(mockStock);
  });

  it("recordReturnStock posts to /inventory/returns", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: {
          data: { inventory: mockStock, movement: mockMovement },
        },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const dto = {
      warehouseId: "wh-1",
      productId: "prod-1",
      quantity: 2,
      technicianId: "tech-1",
      notes: "Unused patch cords returned",
    };

    const result = await recordReturnStock(dto);
    expect(capturedUrl).toBe("/inventory/returns");
    expect(capturedData).toEqual(dto);
    expect(result.movement).toEqual(mockMovement);
  });

  it("transferStock posts to /inventory/transfer with normalized keys", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: {
          data: {
            sourceInventory: mockStock,
            destInventory: { ...mockStock, warehouseId: "wh-2" },
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const dto = {
      fromWarehouseId: "wh-1",
      toWarehouseId: "wh-2",
      productId: "prod-1",
      quantity: 10,
      notes: "Balancing stock across branches",
    };

    const result = await transferStock(dto);
    expect(capturedUrl).toBe("/inventory/transfer");
    expect(capturedData).toEqual(dto);
    expect(result.sourceInventory.warehouseId).toBe("wh-1");
    expect(result.destInventory.warehouseId).toBe("wh-2");
  });

  it("adjustStock posts to /inventory/adjust with notes and newQuantity", async () => {
    let capturedUrl = "";
    let capturedData: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedData = JSON.parse(config.data as string);
      return {
        data: {
          data: { inventory: mockStock, movement: mockMovement },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const dto = {
      warehouseId: "wh-1",
      productId: "prod-1",
      newQuantity: 50,
      notes: "Physical inventory count adjustment",
    };

    const result = await adjustStock(dto);
    expect(capturedUrl).toBe("/inventory/adjust");
    expect(capturedData).toEqual(dto);
    expect(result.inventory).toEqual(mockStock);
  });
});

