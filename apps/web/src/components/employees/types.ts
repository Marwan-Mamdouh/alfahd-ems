import type { Department, Role, UserStatus } from "@alfahd/types";

export interface StatusHistoryEntry {
  from: UserStatus;
  to: UserStatus;
  reason: string;
  changedAt: string;
  changedBy?: string;
}

export interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  nationalId?: string | null;
  hireDate?: string | null;
  department: Department | string | null;
  role: Role | string;
  assignedWarehouseId?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  status: UserStatus;
  profilePhotoKey?: string | null;
  profilePhotoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  statusChanges?: StatusHistoryEntry[];
}

export interface WarehouseOption {
  id: string;
  name: string;
}

export interface CreateEmployeeValues {
  name: string;
  email: string;
  role: Role;
  department: Department | "";
  phone: string;
  nationalId: string;
  hireDate: string;
  assignedWarehouseId?: string;
  warehouseId: string;
  photoFile?: File | null;
}

export interface UpdateEmployeeValues {
  name: string;
  department: Department | "";
  phone: string;
  assignedWarehouseId?: string;
  warehouseId: string;
}

export interface UpdateEmployeeStatusValues {
  status: UserStatus;
  reason: string;
}

export interface EmployeeFiltersValue {
  search: string;
  department: string;
  role: string;
  status: string;
  warehouseId?: string;
}

export interface ServerPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
}
