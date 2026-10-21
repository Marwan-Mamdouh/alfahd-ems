import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { DEPARTMENTS, USER_STATUSES, ATTENDANCE_STATUSES } from '@alfahd/types';

export const roleEnum = pgEnum('role', ['ADMIN', 'WAREHOUSE_STAFF', 'CS', 'TECHNICIAN']);
export const departmentEnum = pgEnum('department', DEPARTMENTS);
export const userStatusEnum = pgEnum('user_status', USER_STATUSES);
export const attendanceStatusEnum = pgEnum('attendance_status', ATTENDANCE_STATUSES);

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }),
  gpsLat: doublePrecision('gps_lat'),
  gpsLng: doublePrecision('gps_lng'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
