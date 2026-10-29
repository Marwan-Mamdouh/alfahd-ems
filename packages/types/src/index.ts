// ─── Roles ────────────────────────────────────────────────────────────────────
export const Role = {
  ADMIN: 'ADMIN',
  WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
  CS: 'CS',
  TECHNICIAN: 'TECHNICIAN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// ─── Auth DTOs ──────────────────────────────────────────────────────────────
export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  // Refresh token is handled via HTTP-only cookie for web, or explicitly returned for mobile
  refreshToken?: string;
  user: UserDto;
}

export interface RefreshTokenRequestDto {
  // Used by mobile apps; web clients send no token and rely on the HTTP-only
  // refresh cookie, so this is optional. At least one of cookie/body must be
  // present or the request is rejected with 401.
  refreshToken?: string;
}

export interface RefreshTokenResponseDto {
  accessToken: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequestDto {
  oldPassword: string;
  newPassword: string;
}

// ─── User DTOs ──────────────────────────────────────────────────────────────
export interface UserDto {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string; // Initially set by admin
  role: Role;
}

export interface UpdateUserDto {
  email?: string;
  role?: Role;
  isActive?: boolean; // Used for soft-deactivation
}

// ─── Ticket ───────────────────────────────────────────────────────────────────
export const TicketStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketType = {
  INSTALLATION: 'INSTALLATION',
  TECHNICAL_ISSUE: 'TECHNICAL_ISSUE',
  COMPLAINT: 'COMPLAINT',
  MAINTENANCE: 'MAINTENANCE',
} as const;

export type TicketType = (typeof TicketType)[keyof typeof TicketType];

export const TicketPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

// ─── Router ───────────────────────────────────────────────────────────────────
export const ROUTER_STATUSES = [
  'AVAILABLE',
  'ASSIGNED_TO_TECHNICIAN',
  'INSTALLED_AT_CUSTOMER',
  'RETURNED',
  'DAMAGED',
  'UNDER_REPAIR',
  'LOST',
  'DECOMMISSIONED',
] as const;

type ValueMap<T extends readonly string[]> = { readonly [Value in T[number]]: Value };

function toValueMap<const T extends readonly string[]>(values: T): ValueMap<T> {
  return Object.fromEntries(values.map((value) => [value, value])) as ValueMap<T>;
}

// Keep the existing object API while making each tuple the source of truth.
export const RouterStatus = toValueMap(ROUTER_STATUSES);

export type RouterStatus = (typeof ROUTER_STATUSES)[number];

export const ROUTER_HOLDER_TYPES = ['WAREHOUSE', 'TECHNICIAN', 'CUSTOMER'] as const;
export const RouterHolderType = toValueMap(ROUTER_HOLDER_TYPES);

export type RouterHolderType = (typeof ROUTER_HOLDER_TYPES)[number];

export const ROUTER_PHYSICAL_CONDITIONS = [
  'SERVICEABLE',
  'DAMAGED',
  'UNDER_REPAIR',
] as const;
export const RouterPhysicalCondition = toValueMap(ROUTER_PHYSICAL_CONDITIONS);

export type RouterPhysicalCondition = (typeof ROUTER_PHYSICAL_CONDITIONS)[number];

// ─── IP Address ───────────────────────────────────────────────────────────────
export const IP_STATUSES = ['FREE', 'RESERVED'] as const;
export const IpStatus = toValueMap(IP_STATUSES);

export type IpStatus = (typeof IP_STATUSES)[number];

export const IP_HISTORY_ACTIONS = [
  'CREATE',
  'RESERVE',
  'RELEASE',
  'ARCHIVE',
  'UNARCHIVE',
  'UPDATE_METADATA',
] as const;
export const IpHistoryAction = toValueMap(IP_HISTORY_ACTIONS);

export type IpHistoryAction = (typeof IP_HISTORY_ACTIONS)[number];

// ─── Attendance ───────────────────────────────────────────────────────────────
export const ATTENDANCE_STATUSES = [
  'ON_TIME',
  'LATE',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const AttendanceStatus = {
  ON_TIME: 'ON_TIME',
  LATE: 'LATE',
} as const;

// ─── Customer ─────────────────────────────────────────────────────────────────
export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

// ─── Department ───────────────────────────────────────────────────────────────
export const DEPARTMENTS = [
  'TECHNICAL',
  'CUSTOMER_SERVICE',
  'WAREHOUSE',
  'MANAGEMENT',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const Department = {
  TECHNICAL: 'TECHNICAL',
  CUSTOMER_SERVICE: 'CUSTOMER_SERVICE',
  WAREHOUSE: 'WAREHOUSE',
  MANAGEMENT: 'MANAGEMENT',
} as const;

// ─── User / Employee Status ───────────────────────────────────────────────────
export const USER_STATUSES = [
  'ACTIVE',
  'ON_LEAVE',
  'INACTIVE',
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  INACTIVE: 'INACTIVE',
} as const;

export const EmployeeStatus = UserStatus;
export type EmployeeStatus = UserStatus;

// ─── Employee DTOs ────────────────────────────────────────────────────────────
export interface EmployeeDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department | null;
  phone?: string | null;
  nationalId?: string | null;
  hireDate?: string | null;
  status: UserStatus;
  assignedWarehouseId?: string | null;
  profilePhotoKey?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateEmployeeDto {
  name: string;
  email: string;
  role: Role;
  department?: Department;
  phone?: string;
  nationalId?: string;
  hireDate?: string;
  assignedWarehouseId?: string;
}

export type CreateEmployeeRequestDto = CreateEmployeeDto;

export interface UpdateEmployeeDto {
  name?: string;
  department?: Department;
  phone?: string;
  assignedWarehouseId?: string;
}

export type UpdateEmployeeRequestDto = UpdateEmployeeDto;

export interface UpdateEmployeeStatusDto {
  status: UserStatus;
  reason: string;
}

export type UpdateEmployeeStatusRequestDto = UpdateEmployeeStatusDto;

export interface EmployeeQueryDto {
  role?: Role;
  department?: Department;
  status?: UserStatus;
  warehouse_id?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

// ─── Attendance DTOs ──────────────────────────────────────────────────────────
export interface CheckInRequestDto {
  lat: number;
  lng: number;
}

export type CheckInDto = CheckInRequestDto;

export interface AttendanceRecordDto {
  id: string;
  userId?: string;
  workDate: string;
  checkInAt: string;
  checkInLat?: number;
  checkInLng?: number;
  checkInDistanceM: number;
  checkOutAt?: string | null;
  status: AttendanceStatus;
  hoursWorked?: number | null;
  overrideReason?: string | null;
  overriddenBy?: string | null;
  overriddenAt?: string | null;
}

export interface OverrideAttendanceDto {
  checkInAt?: string;
  checkOutAt?: string;
  status?: AttendanceStatus;
  overrideReason: string;
}

export type OverrideAttendanceRequestDto = OverrideAttendanceDto;

export interface AttendanceQueryDto {
  from?: string;
  to?: string;
  department?: Department;
  employee_id?: string;
}

export interface JobStatusResponseDto {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  downloadUrl?: string | null;
  error?: string | null;
}

// ─── Router DTOs ──────────────────────────────────────────────────────────────
export interface RouterDto {
  id: string;
  serialNumber: string;
  productId: string;
  status: RouterStatus;
  physicalCondition: RouterPhysicalCondition;
  warehouseId: string | null;
  externalLocation: string | null;
  currentHolderType: RouterHolderType | null;
  currentHolderId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RouterAssignmentDto {
  id: string;
  routerId: string;
  holderType: RouterHolderType;
  warehouseId: string | null;
  technicianId: string | null;
  assignedAt: string;
  releasedAt: string | null;
  assignedBy: string;
  notes: string | null;
}

export interface RouterConditionHistoryDto {
  id: string;
  routerId: string;
  fromCondition: RouterPhysicalCondition;
  toCondition: RouterPhysicalCondition;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  externalLocation: string | null;
  reason: string;
  changedBy: string;
  createdAt: string;
}

export interface CreateRouterDto {
  serialNumber: string;
  productId: string;
  warehouseId: string;
  physicalCondition?: RouterPhysicalCondition;
  isNewReceipt?: boolean; // true = new inbound receipt (+1 quantity), false/undefined = register existing stock (+0)
  notes?: string;
}

export interface AssignRouterDto {
  technicianId: string;
  notes?: string;
}

export interface UpdateRouterConditionDto {
  physicalCondition: RouterPhysicalCondition;
  warehouseId?: string;
  externalLocation?: string;
  reason: string;
}

export interface TransitionRouterDto {
  status: RouterStatus;
  reason?: string;
  targetWarehouseId?: string;
  notes?: string;
}

export interface RouterQueryDto {
  status?: RouterStatus;
  physicalCondition?: RouterPhysicalCondition;
  warehouseId?: string;
  productId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── IP Address DTOs ──────────────────────────────────────────────────────────
export interface IpAddressDto {
  id: string;
  address: string;
  status: IpStatus;
  isArchived: boolean;
  customerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIpDto {
  address: string;
  notes?: string;
}

export interface UpdateIpDto {
  notes?: string;
}

export interface IpHistoryDto {
  id: string;
  ipId: string;
  fromStatus: IpStatus;
  toStatus: IpStatus;
  action: IpHistoryAction;
  reason: string | null;
  actorId: string;
  createdAt: string;
}

export interface IpQueryDto {
  status?: IpStatus;
  isArchived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IpImportResultDto {
  total: number;
  inserted: number;
  skipped: number;
  errors: Array<{
    row: number;
    address: string;
    reason: string;
  }>;
}

// ─── Router Inventory Report DTOs ─────────────────────────────────────────────
export interface RouterReportQueryDto {
  warehouseId?: string;
}

