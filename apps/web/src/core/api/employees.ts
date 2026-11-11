import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import type {
  EmployeeLookupDto,
  EmployeeLookupQueryDto,
  EmployeeDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
} from "@/core/api/types";

/**
 * Minimal employee lookup for selectors and dropdowns without sensitive PII (SEC-04).
 * Accessible by both ADMIN and WAREHOUSE_STAFF.
 */
export async function fetchEmployeeLookup(
  params?: EmployeeLookupQueryDto
): Promise<EmployeeLookupDto[]> {
  const response = await api.get<{ data: EmployeeLookupDto[] }>(
    ENDPOINTS.employees.lookup,
    { params }
  );
  return unwrap(response);
}

/**
 * Fetch full employee details by ID (ADMIN only, or self).
 */
export async function fetchEmployeeById(id: string): Promise<EmployeeDto> {
  const response = await api.get<{ data: EmployeeDto }>(ENDPOINTS.employees.detail(id));
  return unwrap(response);
}

/**
 * Create a new employee (ADMIN only).
 */
export async function createEmployee(dto: CreateEmployeeDto): Promise<EmployeeDto> {
  const response = await api.post<{ data: EmployeeDto }>(ENDPOINTS.employees.create, dto);
  return unwrap(response);
}

/**
 * Update an employee (ADMIN only).
 */
export async function updateEmployee(
  id: string,
  dto: UpdateEmployeeDto
): Promise<EmployeeDto> {
  const response = await api.patch<{ data: EmployeeDto }>(
    ENDPOINTS.employees.update(id),
    dto
  );
  return unwrap(response);
}

/**
 * Update employee status with mandatory reason (ADMIN only).
 */
export async function updateEmployeeStatus(
  id: string,
  dto: UpdateEmployeeStatusDto
): Promise<EmployeeDto> {
  const response = await api.patch<{ data: EmployeeDto }>(
    ENDPOINTS.employees.updateStatus(id),
    dto
  );
  return unwrap(response);
}

