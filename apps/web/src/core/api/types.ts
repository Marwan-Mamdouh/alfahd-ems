export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | number | boolean | undefined>;
}
export type Role = "ADMIN" | "WAREHOUSE_STAFF" | "CUSTOMER_SERVICE" | "TECHNICIAN";

export type Department = "WAREHOUSE" | "TECHNICAL" | "CUSTOMER_SERVICE" | "MANAGEMENT";

export type EmployeeStatus = "ACTIVE" | "INACTIVE";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: Department;
  warehouseId?: string;
  status: EmployeeStatus;
}


export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
