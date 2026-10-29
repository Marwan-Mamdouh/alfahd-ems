import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  inet,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  DEPARTMENTS,
  USER_STATUSES,
  ATTENDANCE_STATUSES,
  ROUTER_STATUSES,
  ROUTER_HOLDER_TYPES,
  ROUTER_PHYSICAL_CONDITIONS,
  IP_STATUSES,
  IP_HISTORY_ACTIONS,
} from '@alfahd/types';

export const roleEnum = pgEnum('role', ['ADMIN', 'WAREHOUSE_STAFF', 'CS', 'TECHNICIAN']);
export const departmentEnum = pgEnum('department', DEPARTMENTS);
export const userStatusEnum = pgEnum('user_status', USER_STATUSES);
export const attendanceStatusEnum = pgEnum('attendance_status', ATTENDANCE_STATUSES);

export const routerStatusEnum = pgEnum('router_status', ROUTER_STATUSES);
export const routerHolderTypeEnum = pgEnum('router_holder_type', ROUTER_HOLDER_TYPES);
export const routerPhysicalConditionEnum = pgEnum(
  'router_physical_condition',
  ROUTER_PHYSICAL_CONDITIONS,
);
export const ipStatusEnum = pgEnum('ip_status', IP_STATUSES);
export const ipHistoryActionEnum = pgEnum('ip_history_action', IP_HISTORY_ACTIONS);

// ─── Auth & RBAC ────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).default('').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum('role').notNull(),
  department: departmentEnum('department'),
  phone: varchar('phone', { length: 30 }),
  nationalId: varchar('national_id', { length: 30 }),
  hireDate: date('hire_date'),
  profilePhotoKey: varchar('profile_photo_key', { length: 255 }),
  status: userStatusEnum('status').default('ACTIVE').notNull(),
  assignedWarehouseId: uuid('assigned_warehouse_id').references(() => warehouses.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    workDate: date('work_date').notNull(),
    checkInAt: timestamp('check_in_at', { withTimezone: true }).notNull(),
    checkInLat: doublePrecision('check_in_lat').notNull(),
    checkInLng: doublePrecision('check_in_lng').notNull(),
    checkInDistanceM: doublePrecision('check_in_distance_m').notNull(),
    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    status: attendanceStatusEnum('status').notNull(),
    overrideReason: text('override_reason'),
    overriddenBy: uuid('overridden_by').references(() => users.id),
    overriddenAt: timestamp('overridden_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('attendance_records_user_id_work_date_unique').on(t.userId, t.workDate),
    // Report generation filters by date range only (`work_date >= from AND
    // work_date <= to`); the composite (user_id, work_date) unique index cannot
    // serve that, so date-range reports would otherwise seq-scan the table.
    index('attendance_records_work_date_idx').on(t.workDate),
    check('check_in_lat_range', sql`${t.checkInLat} >= -90 AND ${t.checkInLat} <= 90`),
    check('check_in_lng_range', sql`${t.checkInLng} >= -180 AND ${t.checkInLng} <= 180`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;

// ─── Inventory ────────────────────────────────────────────────────────────────

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }),
  gpsLat: doublePrecision('gps_lat'),
  gpsLng: doublePrecision('gps_lng'),
  // Per-warehouse geofence radius in metres. Attendance keeps using
  // ATTENDANCE_RADIUS_M for now; the column is exposed by the Warehouses API.
  geofenceRadiusMeters: integer('geofence_radius_meters').default(150).notNull(),
  // Deliberately not a FK: `users.assignedWarehouseId` already references this
  // table, and a back-reference would create a circular drizzle type inference.
  managerId: uuid('manager_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Warehouse stock movement types (SOW 2.1.6).
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'INBOUND_SUPPLIER', // Receiving new stock from supplier (free-text supplier name)
  'OUTBOUND_TECHNICIAN', // Issuing equipment/accessories to technicians
  'RETURN_TECHNICIAN', // Unused or retrieved equipment returned to warehouse
  'TRANSFER_WAREHOUSE', // Transfer between multiple warehouses
  'ADJUSTMENT', // Discrepancy corrections from physical audits
]);

// 1. Catalog Products / Items
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  model: varchar('model', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  description: text('description'),
  lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Warehouse Stock Quantities
export const warehouseInventory = pgTable(
  'warehouse_inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    warehouseId: uuid('warehouse_id')
      .references(() => warehouses.id, { onDelete: 'cascade' })
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    quantity: integer('quantity').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_inventory_warehouse_product').on(table.warehouseId, table.productId),
  ],
);

// 3. Stock Movement Audit Trail
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    warehouseId: uuid('warehouse_id')
      .references(() => warehouses.id)
      .notNull(),
    movementType: stockMovementTypeEnum('movement_type').notNull(),
    quantity: integer('quantity').notNull(),

    // Free-text supplier per SOW Section 6 (out of scope to have separate supplier entity)
    supplierName: varchar('supplier_name', { length: 255 }),

    technicianId: uuid('technician_id').references(() => users.id),
    responsibleUserId: uuid('responsible_user_id')
      .references(() => users.id)
      .notNull(),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_stock_movements_warehouse').on(table.warehouseId),
    index('idx_stock_movements_product').on(table.productId),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export interface ProductWithStock extends Product {
  totalStock: number;
  isLowStock: boolean;
}

export type WarehouseInventory = typeof warehouseInventory.$inferSelect;
export type NewWarehouseInventory = typeof warehouseInventory.$inferInsert;

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;

// ─── Supply Chain: Routers & Custody (M2b) ────────────────────────────────────

export const routers = pgTable(
  'routers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serialNumber: varchar('serial_number', { length: 100 }).notNull().unique(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    status: routerStatusEnum('status').default('AVAILABLE').notNull(),
    physicalCondition: routerPhysicalConditionEnum('physical_condition')
      .default('SERVICEABLE')
      .notNull(),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    externalLocation: varchar('external_location', { length: 255 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_routers_warehouse').on(table.warehouseId),
    index('idx_routers_product').on(table.productId),
    index('idx_routers_status').on(table.status),
    index('idx_routers_physical_condition').on(table.physicalCondition),
  ],
);

export const routerAssignments = pgTable(
  'router_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    routerId: uuid('router_id')
      .references(() => routers.id)
      .notNull(),
    holderType: routerHolderTypeEnum('holder_type').notNull(),
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    technicianId: uuid('technician_id').references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    assignedBy: uuid('assigned_by')
      .references(() => users.id)
      .notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('idx_router_assignments_router').on(table.routerId),
    index('idx_router_assignments_technician').on(table.technicianId),
    index('idx_router_assignments_warehouse').on(table.warehouseId),
    // Enforce AT MOST ONE active custody assignment per router (partial unique index)
    uniqueIndex('idx_router_active_assignment')
      .on(table.routerId)
      .where(sql`${table.releasedAt} IS NULL`),
  ],
);

export const routerConditionHistory = pgTable(
  'router_condition_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    routerId: uuid('router_id')
      .references(() => routers.id)
      .notNull(),
    fromCondition: routerPhysicalConditionEnum('from_condition').notNull(),
    toCondition: routerPhysicalConditionEnum('to_condition').notNull(),
    fromWarehouseId: uuid('from_warehouse_id').references(() => warehouses.id),
    toWarehouseId: uuid('to_warehouse_id').references(() => warehouses.id),
    externalLocation: varchar('external_location', { length: 255 }),
    reason: text('reason').notNull(),
    changedBy: uuid('changed_by')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_router_condition_history_router').on(table.routerId)],
);

// ─── Supply Chain: IP Address Management (M2b) ────────────────────────────────

export const ipAddresses = pgTable(
  'ip_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    address: inet('address').notNull().unique(),
    status: ipStatusEnum('status').default('FREE').notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    // Customer FK deferred to M4a - bare nullable UUID
    customerId: uuid('customer_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ip_addresses_status').on(table.status),
    index('idx_ip_addresses_is_archived').on(table.isArchived),
  ],
);

export const ipHistory = pgTable(
  'ip_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ipId: uuid('ip_id')
      .references(() => ipAddresses.id)
      .notNull(),
    fromStatus: ipStatusEnum('from_status').notNull(),
    toStatus: ipStatusEnum('to_status').notNull(),
    action: ipHistoryActionEnum('action').notNull(),
    reason: text('reason'),
    actorId: uuid('actor_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ip_history_ip').on(table.ipId),
    index('idx_ip_history_actor').on(table.actorId),
  ],
);

export type Router = typeof routers.$inferSelect;
export type NewRouter = typeof routers.$inferInsert;

export type RouterAssignment = typeof routerAssignments.$inferSelect;
export type NewRouterAssignment = typeof routerAssignments.$inferInsert;

export type RouterConditionHistory = typeof routerConditionHistory.$inferSelect;
export type NewRouterConditionHistory = typeof routerConditionHistory.$inferInsert;

export type IpAddress = typeof ipAddresses.$inferSelect;
export type NewIpAddress = typeof ipAddresses.$inferInsert;

export type IpHistory = typeof ipHistory.$inferSelect;
export type NewIpHistory = typeof ipHistory.$inferInsert;
