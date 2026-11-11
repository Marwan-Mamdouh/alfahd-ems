import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import { normalizePaginatedResponse } from "@/core/api/pagination";
import type {
  ProductDto,
  CreateProductDto,
  UpdateProductDto,
  QueryProductsDto,
  PaginatedResult,
} from "@/core/api/types";

/**
 * Fetch paginated products catalog with optional search, category, and low stock filters.
 */
export async function fetchProducts(
  params?: QueryProductsDto
): Promise<PaginatedResult<ProductDto>> {
  const response = await api.get<{ data: { items: ProductDto[]; total: number } }>(
    ENDPOINTS.products.list,
    { params }
  );
  const data = unwrap(response);
  const page =
    params?.offset !== undefined && params?.limit
      ? Math.floor(params.offset / params.limit) + 1
      : 1;
  const pageSize = params?.limit ?? 20;
  return normalizePaginatedResponse<ProductDto>(data, page, pageSize);
}

/**
 * Fetch a single product by ID.
 */
export async function fetchProductById(id: string): Promise<ProductDto> {
  const response = await api.get<{ data: ProductDto }>(
    ENDPOINTS.products.byId(id)
  );
  return unwrap(response);
}

/**
 * Create a new product in the catalog (ADMIN, WAREHOUSE_STAFF).
 * Normalizes SKU to uppercase before submission.
 */
export async function createProduct(
  dto: CreateProductDto
): Promise<ProductDto> {
  const payload: CreateProductDto = {
    ...dto,
    sku: dto.sku.trim().toUpperCase(),
  };
  const response = await api.post<{ data: ProductDto }>(
    ENDPOINTS.products.create,
    payload
  );
  return unwrap(response);
}

/**
 * Update an existing product (ADMIN, WAREHOUSE_STAFF).
 */
export async function updateProduct(
  id: string,
  dto: UpdateProductDto
): Promise<ProductDto> {
  const payload: UpdateProductDto = {
    ...dto,
    ...(dto.sku ? { sku: dto.sku.trim().toUpperCase() } : {}),
  };
  const response = await api.patch<{ data: ProductDto }>(
    ENDPOINTS.products.update(id),
    payload
  );
  return unwrap(response);
}

