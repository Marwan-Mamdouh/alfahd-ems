import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "../axios-instance";
import {
  fetchProducts,
  fetchProductById,
  createProduct,
  updateProduct,
} from "../products";
import type { ProductDto, CreateProductDto, UpdateProductDto } from "../types";

describe("Products API Client Functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProduct: ProductDto = {
    id: "prod-1",
    name: "Wi-Fi 6 Router",
    sku: "RTR-WIFI6-01",
    model: "Archer AX55",
    category: "Routers",
    description: "High-performance router",
    lowStockThreshold: 10,
    isSerialized: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("fetchProducts queries /products and normalizes pagination", async () => {
    let capturedUrl = "";
    let capturedParams: Record<string, unknown> = {};

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedParams = (config.params as Record<string, unknown>) ?? {};
      return {
        data: {
          data: {
            items: [mockProduct],
            total: 1,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchProducts({ category: "Routers", limit: 10, offset: 0 });

    expect(capturedUrl).toBe("/products");
    expect(capturedParams).toEqual({ category: "Routers", limit: 10, offset: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(mockProduct);
  });

  it("fetchProductById queries /products/:id", async () => {
    let capturedUrl = "";

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      return {
        data: { data: mockProduct },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const result = await fetchProductById("prod-1");
    expect(capturedUrl).toBe("/products/prod-1");
    expect(result).toEqual(mockProduct);
  });

  it("createProduct normalizes SKU to uppercase and posts to /products", async () => {
    let capturedBody: Record<string, unknown> = {};

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedBody = JSON.parse(config.data as string);
      return {
        data: { data: mockProduct },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const createDto: CreateProductDto = {
      name: "Wi-Fi 6 Router",
      sku: "  rtr-wifi6-01  ",
      model: "Archer AX55",
      category: "Routers",
      lowStockThreshold: 15,
    };

    const result = await createProduct(createDto);
    expect(capturedBody.sku).toBe("RTR-WIFI6-01");
    expect(result).toEqual(mockProduct);
  });

  it("updateProduct patches /products/:id with uppercase SKU when provided", async () => {
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedUrl = config.url ?? "";
      capturedBody = JSON.parse(config.data as string);
      return {
        data: { data: { ...mockProduct, sku: "RTR-NEW-02" } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const updateDto: UpdateProductDto = {
      sku: "  rtr-new-02 ",
    };

    const result = await updateProduct("prod-1", updateDto);
    expect(capturedUrl).toBe("/products/prod-1");
    expect(capturedBody.sku).toBe("RTR-NEW-02");
    expect(result.sku).toBe("RTR-NEW-02");
  });
});

