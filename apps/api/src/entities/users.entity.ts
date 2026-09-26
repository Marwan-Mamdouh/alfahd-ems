import { pgTable, uuid, varchar, text, timestamp, date, index } from 'drizzle-orm/pg-core';
import { userRoleEnum, departmentEnum, employeeStatusEnum } from './enums.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 50 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull(),
    department: departmentEnum('department').notNull(),
    status: employeeStatusEnum('status').default('ACTIVE').notNull(),

    // Home warehouse: Technicians and Warehouse staff are assigned here
    assignedWarehouseId: uuid('assigned_warehouse_id'),
    hireDate: date('hire_date').notNull(),

    // LMS Architectural Pillar: Session Concurrency Guard (single active mobile/web session)
    activeSessionId: uuid('active_session_id'),

    // Mobile Push Notification Token (Firebase Cloud Messaging)
    fcmPushToken: text('fcm_push_token'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_role').on(table.role),
    index('idx_users_warehouse').on(table.assignedWarehouseId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
