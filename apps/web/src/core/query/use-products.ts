"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/query/query-keys";
import {
  fetchProducts,
  fetchProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/core/api/products";
import type {
  CreateProductDto,
  UpdateProductDto,
  QueryProductsDto,
} from "@/core/api/types";

export interface UseProductsOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch paginated products catalog.
 */
export function useProducts(
  params?: QueryProductsDto,
  options?: UseProductsOptions
) {
  const query = useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => fetchProducts(params),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    products: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? 1,
    pageSize: query.data?.pageSize ?? 20,
    totalPages: query.data?.totalPages ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch a single product by ID.
 */
export function useProduct(id?: string, options?: UseProductsOptions) {
  const query = useQuery({
    queryKey: id ? queryKeys.products.detail(id) : queryKeys.products.details(),
    queryFn: () => fetchProductById(id!),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 60_000,
  });

  return {
    product: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/**
 * Mutation hook to create a product.
 * Invalidates product list and inventory stock caches.
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateProductDto) => createProduct(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Mutation hook to update an existing product.
 * Invalidates product list, product detail, and inventory stock caches.
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProductDto }) =>
      updateProduct(id, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

/**
 * Mutation hook to deactivate a product (ADMIN only).
 * Performs soft deactivation; physical hard deletion is strictly prohibited.
 * Invalidates product list, product detail, and inventory stock caches.
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}


