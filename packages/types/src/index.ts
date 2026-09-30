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
  refreshToken: string; // Used by mobile apps, web uses cookies
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
export const AttendanceStatus = {
  ON_TIME: 'ON_TIME',
  LATE: 'LATE',
  ABSENT: 'ABSENT',
} as const;

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

// ─── Customer ─────────────────────────────────────────────────────────────────
export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

// ─── Employee / Department ────────────────────────────────────────────────────
// OI-02: Department enum values are UNRESOLVED pending client confirmation.
// Placeholder values below. DO NOT use in production schema until confirmed.
export const Department = {
  WAREHOUSE: 'WAREHOUSE',
  TECHNICAL: 'TECHNICAL',
  CUSTOMER_SERVICE: 'CUSTOMER_SERVICE',
  MANAGEMENT: 'MANAGEMENT',
} as const;

export type Department = (typeof Department)[keyof typeof Department];

export const EmployeeStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];
