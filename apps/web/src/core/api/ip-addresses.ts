import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import { normalizePaginatedResponse } from "@/core/api/pagination";
import type {
  IpAddressDto,
  CreateIpDto,
  UpdateIpDto,
  IpHistoryDto,
  IpQueryDto,
  PaginatedResult,
} from "@/core/api/types";

/**
 * Fetch paginated IPv4 addresses with optional filtering (status, isArchived, search).
 * Supported by ADMIN and TECHNICIAN roles.
 */
export async function fetchIpAddresses(
  params?: IpQueryDto
): Promise<PaginatedResult<IpAddressDto>> {
  const page = params?.page ?? 1;
  const pageSize = params?.limit ?? 20;

  const response = await api.get<{
    data: { items: IpAddressDto[]; total: number } | IpAddressDto[];
  }>(ENDPOINTS.ipAddresses.list, {
    params: {
      ...params,
      page,
      limit: pageSize,
    },
  });

  const data = unwrap(response);
  return normalizePaginatedResponse<IpAddressDto>(data, page, pageSize);
}

/**
 * Fetch a single IP address by UUID.
 * Supported by ADMIN and TECHNICIAN roles.
 */
export async function fetchIpAddressById(id: string): Promise<IpAddressDto> {
  const response = await api.get<{ data: IpAddressDto }>(ENDPOINTS.ipAddresses.byId(id));
  return unwrap(response);
}

/**
 * Register a new individual IPv4 address in FREE status.
 * ADMIN role only.
 */
export async function createIpAddress(dto: CreateIpDto): Promise<IpAddressDto> {
  const response = await api.post<{ data: IpAddressDto }>(
    ENDPOINTS.ipAddresses.create,
    dto
  );
  return unwrap(response);
}

/**
 * Update metadata notes on an IP address.
 * ADMIN role only.
 */
export async function updateIpAddress(
  id: string,
  dto: UpdateIpDto
): Promise<IpAddressDto> {
  const response = await api.patch<{ data: IpAddressDto }>(
    ENDPOINTS.ipAddresses.update(id),
    dto
  );
  return unwrap(response);
}

/**
 * Manually reserve an available FREE IP address.
 * ADMIN role only.
 */
export async function reserveIpAddress(
  id: string,
  reason?: string
): Promise<IpAddressDto> {
  const response = await api.post<{ data: IpAddressDto }>(
    ENDPOINTS.ipAddresses.reserve(id),
    reason !== undefined ? { reason } : {}
  );
  return unwrap(response);
}

/**
 * Release a RESERVED IP address back to FREE.
 * ADMIN role only.
 */
export async function releaseIpAddress(
  id: string,
  reason?: string
): Promise<IpAddressDto> {
  const response = await api.post<{ data: IpAddressDto }>(
    ENDPOINTS.ipAddresses.release(id),
    reason !== undefined ? { reason } : {}
  );
  return unwrap(response);
}

/**
 * Archive a FREE IP address so it cannot be allocated.
 * Throws 409 Conflict if the IP is currently RESERVED.
 * ADMIN role only.
 */
export async function archiveIpAddress(
  id: string,
  reason?: string
): Promise<IpAddressDto> {
  const response = await api.post<{ data: IpAddressDto }>(
    ENDPOINTS.ipAddresses.archive(id),
    reason !== undefined ? { reason } : {}
  );
  return unwrap(response);
}

/**
 * Unarchive an archived IP address, restoring it to the active pool.
 * ADMIN role only.
 */
export async function unarchiveIpAddress(
  id: string,
  reason?: string
): Promise<IpAddressDto> {
  const response = await api.post<{ data: IpAddressDto }>(
    ENDPOINTS.ipAddresses.unarchive(id),
    reason !== undefined ? { reason } : {}
  );
  return unwrap(response);
}

/**
 * Fetch the full mutation audit ledger for an IP address.
 * ADMIN role only.
 */
export async function fetchIpHistory(id: string): Promise<IpHistoryDto[]> {
  const response = await api.get<{ data: IpHistoryDto[] }>(
    ENDPOINTS.ipAddresses.history(id)
  );
  return unwrap(response);
}

