import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import { normalizePaginatedResponse } from "@/core/api/pagination";
import type {
  RouterDto,
  RouterAssignmentDto,
  RouterConditionHistoryDto,
  RouterStatusHistoryDto,
  CreateRouterDto,
  AssignRouterDto,
  UpdateRouterConditionDto,
  TransitionRouterDto,
  RouterQueryDto,
  PaginatedResult,
} from "@/core/api/types";

/**
 * Fetch paginated routers with optional filtering.
 */
export async function fetchRouters(
  params?: RouterQueryDto
): Promise<PaginatedResult<RouterDto>> {
  const page = params?.page ?? 1;
  const pageSize = params?.limit ?? 20;
  const offset = (page - 1) * pageSize;

  const response = await api.get<{
    data: { items: RouterDto[]; total: number } | RouterDto[];
  }>(ENDPOINTS.routers.list, {
    params: {
      ...params,
      limit: pageSize,
      offset,
    },
  });

  const data = unwrap(response);
  return normalizePaginatedResponse<RouterDto>(data, page, pageSize);
}

/**
 * Fetch a single router by ID.
 */
export async function fetchRouterById(id: string): Promise<RouterDto> {
  const response = await api.get<{ data: RouterDto }>(ENDPOINTS.routers.byId(id));
  return unwrap(response);
}

/**
 * Register / receive a physical router asset (ADMIN, WAREHOUSE_STAFF).
 */
export async function createRouter(dto: CreateRouterDto): Promise<RouterDto> {
  const response = await api.post<{ data: RouterDto }>(
    ENDPOINTS.routers.create,
    dto
  );
  return unwrap(response);
}

/**
 * Hand custody of an available router over to a technician (ADMIN, WAREHOUSE_STAFF).
 */
export async function assignRouter(
  id: string,
  dto: AssignRouterDto
): Promise<RouterDto> {
  const response = await api.post<{ data: RouterDto }>(
    ENDPOINTS.routers.assign(id),
    dto
  );
  return unwrap(response);
}

/**
 * Transition router lifecycle along the approved state machine (ADMIN, WAREHOUSE_STAFF).
 */
export async function transitionRouter(
  id: string,
  dto: TransitionRouterDto
): Promise<RouterDto> {
  const response = await api.patch<{ data: RouterDto }>(
    ENDPOINTS.routers.transition(id),
    dto
  );
  return unwrap(response);
}

/**
 * Update physical condition and location context (ADMIN, WAREHOUSE_STAFF).
 */
export async function updateRouterCondition(
  id: string,
  dto: UpdateRouterConditionDto
): Promise<RouterDto> {
  const response = await api.patch<{ data: RouterDto }>(
    ENDPOINTS.routers.condition(id),
    dto
  );
  return unwrap(response);
}

/**
 * Retrieve chronological custody assignment history for an individual router.
 */
export async function fetchRouterAssignments(
  id: string
): Promise<RouterAssignmentDto[]> {
  const response = await api.get<{ data: RouterAssignmentDto[] }>(
    ENDPOINTS.routers.assignments(id)
  );
  return unwrap(response);
}

/**
 * Retrieve hardware condition change audit history for a router.
 */
export async function fetchRouterConditionHistory(
  id: string
): Promise<RouterConditionHistoryDto[]> {
  const response = await api.get<{ data: RouterConditionHistoryDto[] }>(
    ENDPOINTS.routers.conditionHistory(id)
  );
  return unwrap(response);
}

/**
 * Retrieve lifecycle transition audit history for a router.
 */
export async function fetchRouterStatusHistory(
  id: string
): Promise<RouterStatusHistoryDto[]> {
  const response = await api.get<{ data: RouterStatusHistoryDto[] }>(
    ENDPOINTS.routers.statusHistory(id)
  );
  return unwrap(response);
}

