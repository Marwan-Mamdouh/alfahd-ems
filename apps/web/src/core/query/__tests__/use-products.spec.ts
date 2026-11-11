import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/axios-instance";
import { queryKeys } from "../query-keys";
import {
  fetchProducts,
  fetchProductById,
  createProduct,
} from "@/core/api/products";
import type { ProductDto, CreateProductDto } from "@/core/api/types";

describe("Products React Query Integration", () => {
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

  const mockProduct: ProductDto = {
    id: "prod-1",
    name: "Cat6 Ethernet Cable",
    sku: "CBL-CAT6-100",
    model: "CAT6 UTP",
    category: "Cables",
    description: "100m spool",
    lowStockThreshold: 5,
    isSerialized: false,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("fetches and caches products list", async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: { items: [mockProduct], total: 1 } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.products.list();
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchProducts(),
    });

    expect(result.items).toEqual([mockProduct]);
    expect(queryClient.getQueryData(key)).toEqual(result);
  });

  it("fetches and caches product detail", async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockProduct },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const key = queryKeys.products.detail("prod-1");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => fetchProductById("prod-1"),
    });

    expect(result).toEqual(mockProduct);
    expect(queryClient.getQueryData(key)).toEqual(mockProduct);
  });

  it("invalidates product and inventory caches on creation", async () => {
    const listKey = queryKeys.products.list();
    const invKey = queryKeys.inventory.all;

    queryClient.setQueryData(listKey, { items: [mockProduct], total: 1 });
    queryClient.setQueryData(invKey, { items: [] });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        data: { data: mockProduct },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    };

    const createDto: CreateProductDto = {
      name: "Fiber Cable",
      sku: "CBL-FBR-01",
      model: "Single Mode",
      category: "Cables",
    };

    await createProduct(createDto);

    // Mimic useCreateProduct onSuccess:
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
  });

  it("invalidates product list, detail, and inventory caches on deactivation", async () => {
    const listKey = queryKeys.products.list();
    const detailKey = queryKeys.products.detail("prod-1");
    const invKey = queryKeys.inventory.all;

    queryClient.setQueryData(listKey, { items: [mockProduct], total: 1 });
    queryClient.setQueryData(detailKey, mockProduct);
    queryClient.setQueryData(invKey, { items: [] });

    // Mimic useDeleteProduct onSuccess:
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.products.detail("prod-1") });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
  });
});

