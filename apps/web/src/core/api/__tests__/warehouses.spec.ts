import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "../axios-instance";
import {
  fetchWarehouses,
  fetchWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../warehouses";
import type { WarehouseDto, CreateWarehouseDto, UpdateWarehouseDto } from "../types";

describe("Warehouses API Client Functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockWarehouse: WarehouseDto = {
    id: "wh-1",
    name: "Cairo Central",
    address: "Nasr City, Cairo",
    latitude: 30.0561,
    longitude: 31.3301,
    geofenceRadiusMeters: 150,
    managerId: "mgr-1",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("fetchWarehouses queries /warehouses and normalizes pagination", async () => {
    let capturedUrl = "";
    let capturedParams: Record<string, unknown> = {};

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedParams = (config.params as Record<string, unknown>) ?? {};
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

    const result = await fetchWarehouses({ search: "Cairo", limit: 10, offset: 0 });

    expect(capturedUrl).toBe("/warehouses");
    expect(capturedParams).toEqual({ search: "Cairo", limit: 10, offset: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(mockWarehouse);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it("fetchWarehouseById calls /warehouses/:id and unwraps data", async () => {
    let capturedUrl = "";

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      return {
        data: { data: mockWarehouse },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchWarehouseById("wh-1");
    expect(capturedUrl).toBe("/warehouses/wh-1");
    expect(result).toEqual(mockWarehouse);
  });

  it("createWarehouse posts payload to /warehouses", async () => {
    let capturedMethod = "";
    let capturedUrl = "";
    let capturedBody: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedMethod = config.method ?? "";
      capturedUrl = config.url ?? "";
      capturedBody = JSON.parse(config.data as string);
      return {
        data: { data: mockWarehouse },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const createDto: CreateWarehouseDto = {
      name: "Cairo Central",
      address: "Nasr City, Cairo",
      latitude: 30.0561,
      longitude: 31.3301,
      geofenceRadiusMeters: 200,
    };

    const result = await createWarehouse(createDto);
    expect(capturedMethod.toUpperCase()).toBe("POST");
    expect(capturedUrl).toBe("/warehouses");
    expect(capturedBody).toEqual(createDto);
    expect(result).toEqual(mockWarehouse);
  });

  it("updateWarehouse patches payload to /warehouses/:id", async () => {
    let capturedMethod = "";
    let capturedUrl = "";
    let capturedBody: unknown = null;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedMethod = config.method ?? "";
      capturedUrl = config.url ?? "";
      capturedBody = JSON.parse(config.data as string);
      return {
        data: { data: { ...mockWarehouse, name: "Updated Cairo" } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const updateDto: UpdateWarehouseDto = { name: "Updated Cairo" };
    const result = await updateWarehouse("wh-1", updateDto);

    expect(capturedMethod.toUpperCase()).toBe("PATCH");
    expect(capturedUrl).toBe("/warehouses/wh-1");
    expect(capturedBody).toEqual(updateDto);
    expect(result.name).toBe("Updated Cairo");
  });

  it("deleteWarehouse calls DELETE /warehouses/:id", async () => {
    let capturedMethod = "";
    let capturedUrl = "";

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedMethod = config.method ?? "";
      capturedUrl = config.url ?? "";
      return {
        data: undefined,
        status: 204,
        statusText: "No Content",
        headers: {},
        config,
      };
    };

    await deleteWarehouse("wh-1");
    expect(capturedMethod.toUpperCase()).toBe("DELETE");
    expect(capturedUrl).toBe("/warehouses/wh-1");
  });
});

