import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.entity.js';

export const warehouses = pgTable('warehouses', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),

  // Geofence radius in metres (default 150m per SOW Section 2.1.4)
  geofenceRadiusMeters: integer('geofence_radius_meters').default(150).notNull(),
  managerId: uuid('manager_id').references(() => users.id),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
