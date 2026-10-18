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
export const RouterStatus = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED_TO_TECHNICIAN: 'ASSIGNED_TO_TECHNICIAN',
  INSTALLED_AT_CUSTOMER: 'INSTALLED_AT_CUSTOMER',
  RETURNED: 'RETURNED',
  DAMAGED: 'DAMAGED',
  UNDER_REPAIR: 'UNDER_REPAIR',
  LOST: 'LOST',
  DECOMMISSIONED: 'DECOMMISSIONED',
} as const;

export type RouterStatus = (typeof RouterStatus)[keyof typeof RouterStatus];

export const RouterHolderType = {
  WAREHOUSE: 'WAREHOUSE',
  TECHNICIAN: 'TECHNICIAN',
  CUSTOMER: 'CUSTOMER',
} as const;

export type RouterHolderType = (typeof RouterHolderType)[keyof typeof RouterHolderType];

// ─── IP Address ───────────────────────────────────────────────────────────────
export const IpStatus = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  RESERVED: 'RESERVED',
  RETIRED: 'RETIRED',
} as const;

export type IpStatus = (typeof IpStatus)[keyof typeof IpStatus];

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

