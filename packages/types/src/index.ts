// ─── Roles ────────────────────────────────────────────────────────────────────
export enum Role {
  ADMIN = 'ADMIN',
  WAREHOUSE_STAFF = 'WAREHOUSE_STAFF',
  CS = 'CS',
  TECHNICIAN = 'TECHNICIAN',
}

// ─── Ticket ───────────────────────────────────────────────────────────────────
export enum TicketStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TicketType {
  INSTALLATION = 'INSTALLATION',
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',
  COMPLAINT = 'COMPLAINT',
  MAINTENANCE = 'MAINTENANCE',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// ─── Router ───────────────────────────────────────────────────────────────────
export enum RouterStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED_TO_TECHNICIAN = 'ASSIGNED_TO_TECHNICIAN',
  INSTALLED_AT_CUSTOMER = 'INSTALLED_AT_CUSTOMER',
  RETURNED = 'RETURNED',
  DAMAGED = 'DAMAGED',
  UNDER_REPAIR = 'UNDER_REPAIR',
  LOST = 'LOST',
  DECOMMISSIONED = 'DECOMMISSIONED',
}

export enum RouterHolderType {
  WAREHOUSE = 'WAREHOUSE',
  TECHNICIAN = 'TECHNICIAN',
  CUSTOMER = 'CUSTOMER',
}

// ─── IP Address ───────────────────────────────────────────────────────────────
export enum IpStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  RESERVED = 'RESERVED',
  RETIRED = 'RETIRED',
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export enum AttendanceStatus {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
}

// ─── Customer ─────────────────────────────────────────────────────────────────
export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

// ─── Employee / Department ────────────────────────────────────────────────────
// OI-02: Department enum values are UNRESOLVED pending client confirmation.
// Placeholder values below. DO NOT use in production schema until confirmed.
export enum Department {
  WAREHOUSE = 'WAREHOUSE',
  TECHNICAL = 'TECHNICAL',
  CUSTOMER_SERVICE = 'CUSTOMER_SERVICE',
  MANAGEMENT = 'MANAGEMENT',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
