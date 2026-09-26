import { pgEnum } from 'drizzle-orm/pg-core';

// 1. System User Roles (Section 2.1.1 & Section 5 of SOW)
export const userRoleEnum = pgEnum('user_role', [
  'ADMIN',
  'WAREHOUSE_STAFF',
  'CUSTOMER_SERVICE',
  'TECHNICIAN',
]);

// 2. Company Departments (Stored as attribute on employee per SOW 2.1.3)
export const departmentEnum = pgEnum('department', [
  'WAREHOUSE',
  'TECHNICAL',
  'CUSTOMER_SERVICE',
  'MANAGEMENT',
]);

// 3. Employee Account Status
export const employeeStatusEnum = pgEnum('employee_status', ['ACTIVE', 'INACTIVE', 'TERMINATED']);

// 4. Daily Attendance Status
export const attendanceStatusEnum = pgEnum('attendance_status', ['PRESENT', 'LATE', 'ABSENT']);

// 5. Warehouse Stock Movement Types (SOW 2.1.6)
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'INBOUND_SUPPLIER', // Receiving new stock from supplier (free-text supplier name)
  'OUTBOUND_TECHNICIAN', // Issuing equipment/accessories to technicians
  'RETURN_TECHNICIAN', // Unused or retrieved equipment returned to warehouse
  'TRANSFER_WAREHOUSE', // Transfer between multiple warehouses
  'ADJUSTMENT', // Discrepancy corrections from physical audits
]);

// 6. Router Lifecycle Status (State Machine Guard per SOW 2.1.7)
export const routerStatusEnum = pgEnum('router_status', [
  'AVAILABLE',
  'ASSIGNED_TO_TECHNICIAN',
  'INSTALLED_AT_CUSTOMER',
  'RETURNED',
  'DAMAGED',
  'UNDER_REPAIR',
  'LOST',
  'DECOMMISSIONED',
]);

// 7. Hardware Hand-off Transfer Status
export const hardwareTransferStatusEnum = pgEnum('hardware_transfer_status', [
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
]);

// 8. IP Pool Status (Replaces Google Sheets per SOW 2.1.8)
export const ipStatusEnum = pgEnum('ip_status', ['AVAILABLE', 'ASSIGNED', 'RESERVED', 'RETIRED']);

// 9. Service Ticket Types (SOW 2.1.12)
export const ticketTypeEnum = pgEnum('ticket_type', [
  'INSTALLATION', // Mandatory completion photo upload required
  'TECHNICAL_ISSUE', // Optional photo upload
  'COMPLAINT', // Optional photo upload
  'MAINTENANCE', // Optional photo upload
]);

// 10. Service Ticket Priorities
export const ticketPriorityEnum = pgEnum('ticket_priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// 11. Ticket Operational Lifecycle Status
export const ticketStatusEnum = pgEnum('ticket_status', [
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
