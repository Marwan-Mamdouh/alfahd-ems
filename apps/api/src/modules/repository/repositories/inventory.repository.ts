import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import * as schema from '../../../entities/schema.js';
import {
  warehouseInventory,
  type WarehouseInventory,
  type NewWarehouseInventory,
  type StockMovement,
  type NewStockMovement,
} from '../../../entities/inventory.entity.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';

export interface QueryInventoryParams {
  warehouseId?: string;
  productId?: string;
  limit: number;
  offset: number;
}

export interface QueryStockMovementsParams {
  warehouseId?: string;
  productId?: string;
  movementType?: (typeof schema.stockMovementTypeEnum.enumValues)[number];
  technicianId?: string;
  limit: number;
  offset: number;
}

export interface InventoryItemWithDetails extends WarehouseInventory {
  product: {
    id: string;
    name: string;
    sku: string;
    model: string;
    category: string;
    lowStockThreshold: number;
  };
  warehouse: {
    id: string;
    name: string;
  };
}

@Injectable()
export class InventoryRepository extends BaseRepository<
  WarehouseInventory,
  NewWarehouseInventory,
  typeof warehouseInventory,
  typeof schema
> {
  constructor(@Inject(DRIZZLE) protected override readonly db: NodePgDatabase<typeof schema>) {
    super(db, warehouseInventory);
  }

  async getStock(warehouseId: string, productId: string): Promise<WarehouseInventory | undefined> {
    const [record] = await this.db
      .select()
      .from(schema.warehouseInventory)
      .where(
        and(
          eq(schema.warehouseInventory.warehouseId, warehouseId),
          eq(schema.warehouseInventory.productId, productId),
        ),
      )
      .limit(1);

    return record;
  }

  async findManyInventory(
    params: QueryInventoryParams,
  ): Promise<{ items: InventoryItemWithDetails[]; total: number }> {
    const conditions: (SQL | undefined)[] = [];
    if (params.warehouseId) {
      conditions.push(eq(schema.warehouseInventory.warehouseId, params.warehouseId));
    }
    if (params.productId) {
      conditions.push(eq(schema.warehouseInventory.productId, params.productId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          inventory: schema.warehouseInventory,
          product: {
            id: schema.products.id,
            name: schema.products.name,
            sku: schema.products.sku,
            model: schema.products.model,
            category: schema.products.category,
            lowStockThreshold: schema.products.lowStockThreshold,
          },
          warehouse: {
            id: schema.warehouses.id,
            name: schema.warehouses.name,
          },
        })
        .from(schema.warehouseInventory)
        .innerJoin(schema.products, eq(schema.warehouseInventory.productId, schema.products.id))
        .innerJoin(
          schema.warehouses,
          eq(schema.warehouseInventory.warehouseId, schema.warehouses.id),
        )
        .where(whereClause)
        .limit(params.limit)
        .offset(params.offset),
      this.db.select({ total: count() }).from(schema.warehouseInventory).where(whereClause),
    ]);

    const items: InventoryItemWithDetails[] = rows.map((r) => ({
      ...r.inventory,
      product: r.product,
      warehouse: r.warehouse,
    }));

    return { items, total: Number(total) };
  }

  async recordMovementInTransaction(
    movement: NewStockMovement,
    newQuantity: number,
  ): Promise<{ inventory: WarehouseInventory; movement: StockMovement }> {
    return this.db.transaction(async (tx) => {
      const [inventory] = await tx
        .insert(schema.warehouseInventory)
        .values({
          warehouseId: movement.warehouseId,
          productId: movement.productId,
          quantity: newQuantity,
        })
        .onConflictDoUpdate({
          target: [schema.warehouseInventory.warehouseId, schema.warehouseInventory.productId],
          set: {
            quantity: newQuantity,
            updatedAt: new Date(),
          },
        })
        .returning();

      const [createdMovement] = await tx.insert(schema.stockMovements).values(movement).returning();

      return { inventory, movement: createdMovement };
    });
  }

  async executeTransferInTransaction(
    fromWarehouseId: string,
    toWarehouseId: string,
    productId: string,
    transferQty: number,
    sourceNewQty: number,
    destNewQty: number,
    movementOut: NewStockMovement,
    movementIn: NewStockMovement,
  ): Promise<{ sourceInventory: WarehouseInventory; destInventory: WarehouseInventory }> {
    return this.db.transaction(async (tx) => {
      const [sourceInventory] = await tx
        .update(schema.warehouseInventory)
        .set({ quantity: sourceNewQty, updatedAt: new Date() })
        .where(
          and(
            eq(schema.warehouseInventory.warehouseId, fromWarehouseId),
            eq(schema.warehouseInventory.productId, productId),
          ),
        )
        .returning();

      const [destInventory] = await tx
        .insert(schema.warehouseInventory)
        .values({
          warehouseId: toWarehouseId,
          productId,
          quantity: destNewQty,
        })
        .onConflictDoUpdate({
          target: [schema.warehouseInventory.warehouseId, schema.warehouseInventory.productId],
          set: {
            quantity: destNewQty,
            updatedAt: new Date(),
          },
        })
        .returning();

      await tx.insert(schema.stockMovements).values([movementOut, movementIn]);

      return { sourceInventory, destInventory };
    });
  }

  async findManyMovements(
    params: QueryStockMovementsParams,
  ): Promise<{ items: StockMovement[]; total: number }> {
    const conditions: (SQL | undefined)[] = [];
    if (params.warehouseId) {
      conditions.push(eq(schema.stockMovements.warehouseId, params.warehouseId));
    }
    if (params.productId) {
      conditions.push(eq(schema.stockMovements.productId, params.productId));
    }
    if (params.movementType) {
      conditions.push(eq(schema.stockMovements.movementType, params.movementType));
    }
    if (params.technicianId) {
      conditions.push(eq(schema.stockMovements.technicianId, params.technicianId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.stockMovements)
        .where(whereClause)
        .orderBy(desc(schema.stockMovements.createdAt))
        .limit(params.limit)
        .offset(params.offset),
      this.db.select({ total: count() }).from(schema.stockMovements).where(whereClause),
    ]);

    return { items, total: Number(total) };
  }

  async findMovementById(id: string): Promise<StockMovement | undefined> {
    const [movement] = await this.db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.id, id))
      .limit(1);

    return movement;
  }
}
