import type {
  EmployeeQueryDto,
  AttendanceQueryDto,
  RouterQueryDto,
  IpQueryDto,
  QueryWarehousesDto,
  QueryProductsDto,
} from "@/core/api/types";

/**
 * Stable, hierarchical React Query key factories.
 *
 * Pattern:
 * - `all`: Top-level scope for the domain (used for broad invalidations)
 * - `lists`: Scope for all list variants
 * - `list(params)`: Cache key for a specific query parameter set
 * - `details`: Scope for all detail queries
 * - `detail(id)`: Cache key for a single record by ID
 * - sub-resources: Hierarchical extensions under detail or domain
 */

export const usersKeys = {
  all: ["users"] as const,
  lists: () => [...usersKeys.all, "list"] as const,
  list: (params?: unknown) => [...usersKeys.lists(), params] as const,
  details: () => [...usersKeys.all, "detail"] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
};

export const employeesKeys = {
  all: ["employees"] as const,
  lists: () => [...employeesKeys.all, "list"] as const,
  list: (params?: EmployeeQueryDto) => [...employeesKeys.lists(), params] as const,
  details: () => [...employeesKeys.all, "detail"] as const,
  detail: (id: string) => [...employeesKeys.details(), id] as const,
};

export const attendanceKeys = {
  all: ["attendance"] as const,
  lists: () => [...attendanceKeys.all, "list"] as const,
  list: (params?: AttendanceQueryDto) => [...attendanceKeys.lists(), params] as const,
  details: () => [...attendanceKeys.all, "detail"] as const,
  detail: (id: string) => [...attendanceKeys.details(), id] as const,
  today: () => [...attendanceKeys.all, "today"] as const,
};

export const warehousesKeys = {
  all: ["warehouses"] as const,
  lists: () => [...warehousesKeys.all, "list"] as const,
  list: (params?: QueryWarehousesDto) => [...warehousesKeys.lists(), params] as const,
  details: () => [...warehousesKeys.all, "detail"] as const,
  detail: (id: string) => [...warehousesKeys.details(), id] as const,
  stock: (id: string) => [...warehousesKeys.detail(id), "stock"] as const,
};

export const productsKeys = {
  all: ["products"] as const,
  lists: () => [...productsKeys.all, "list"] as const,
  list: (params?: QueryProductsDto) => [...productsKeys.lists(), params] as const,
  details: () => [...productsKeys.all, "detail"] as const,
  detail: (id: string) => [...productsKeys.details(), id] as const,
};

export const inventoryKeys = {
  all: ["inventory"] as const,
  balances: (params?: Record<string, unknown>) =>
    [...inventoryKeys.all, "balances", params] as const,
  warehouseStock: (warehouseId: string) =>
    [...inventoryKeys.all, "warehouse-stock", warehouseId] as const,
  movements: (params?: Record<string, unknown>) =>
    [...inventoryKeys.all, "movements", params] as const,
};

export const routersKeys = {
  all: ["routers"] as const,
  lists: () => [...routersKeys.all, "list"] as const,
  list: (params?: RouterQueryDto) => [...routersKeys.lists(), params] as const,
  details: () => [...routersKeys.all, "detail"] as const,
  detail: (id: string) => [...routersKeys.details(), id] as const,
  assignmentHistory: (id: string) => [...routersKeys.detail(id), "assignments"] as const,
  conditionHistory: (id: string) => [...routersKeys.detail(id), "condition-history"] as const,
  statusHistory: (id: string) => [...routersKeys.detail(id), "status-history"] as const,
};

export const ipAddressesKeys = {
  all: ["ipAddresses"] as const,
  lists: () => [...ipAddressesKeys.all, "list"] as const,
  list: (params?: IpQueryDto) => [...ipAddressesKeys.lists(), params] as const,
  details: () => [...ipAddressesKeys.all, "detail"] as const,
  detail: (id: string) => [...ipAddressesKeys.details(), id] as const,
  history: (id: string) => [...ipAddressesKeys.detail(id), "history"] as const,
};

export const jobsKeys = {
  all: ["jobs"] as const,
  status: (id: string) => [...jobsKeys.all, "status", id] as const,
};

export const queryKeys = {
  users: usersKeys,
  employees: employeesKeys,
  attendance: attendanceKeys,
  warehouses: warehousesKeys,
  products: productsKeys,
  inventory: inventoryKeys,
  routers: routersKeys,
  ipAddresses: ipAddressesKeys,
  jobs: jobsKeys,
} as const;

