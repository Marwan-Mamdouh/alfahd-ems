import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { stockMovementTypeEnum } from './enums.js';
import { warehouses } from './warehouses.entity.js';
import { users } from './users.entity.js';

// 1. Catalog Products / Items
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  model: varchar('model', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  description: text('description'),
  lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Warehouse Stock Quantities
export const warehouseInventory = pgTable(
  'warehouse_inventory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
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
    id: uuid('id').defaultRandom().primaryKey(),
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
