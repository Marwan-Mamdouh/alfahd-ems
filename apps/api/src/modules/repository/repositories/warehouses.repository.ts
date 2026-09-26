import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, ilike, or, and, count, sum, type SQL } from 'drizzle-orm';
import * as schema from '../../../entities/schema.js';
import {
  warehouses,
  type Warehouse,
  type NewWarehouse,
} from '../../../entities/warehouses.entity.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';

export interface QueryWarehousesParams {
  search?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class WarehousesRepository extends BaseRepository<
  Warehouse,
  NewWarehouse,
  typeof warehouses,
  typeof schema
> {
  constructor(@Inject(DRIZZLE) protected override readonly db: NodePgDatabase<typeof schema>) {
    super(db, warehouses);
  }

  async findByName(name: string): Promise<Warehouse | undefined> {
    const [record] = await this.db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.name, name.trim()))
      .limit(1);

    return record;
  }

  async findManyWithPagination(
    params: QueryWarehousesParams,
  ): Promise<{ items: Warehouse[]; total: number }> {
    const whereConditions: (SQL | undefined)[] = [];

    if (params.search) {
      whereConditions.push(
        or(
          ilike(schema.warehouses.name, `%${params.search}%`),
          ilike(schema.warehouses.address, `%${params.search}%`),
        ),
      );
    }

    const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.warehouses)
        .where(whereClause)
        .limit(params.limit)
        .offset(params.offset),
      this.db.select({ total: count() }).from(schema.warehouses).where(whereClause),
    ]);

    return { items, total: Number(total) };
  }

  async updateWarehouse(
    id: string,
    updates: Partial<NewWarehouse>,
  ): Promise<Warehouse | undefined> {
    const [updated] = await this.db
      .update(schema.warehouses)
      .set(updates)
      .where(eq(schema.warehouses.id, id))
      .returning();

    return updated;
  }

  async countActiveInventory(warehouseId: string): Promise<number> {
    const [result] = await this.db
      .select({ total: sum(schema.warehouseInventory.quantity).mapWith(Number) })
      .from(schema.warehouseInventory)
      .where(eq(schema.warehouseInventory.warehouseId, warehouseId));

    return result?.total ?? 0;
  }

  async countAssignedStaff(warehouseId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.users)
      .where(eq(schema.users.assignedWarehouseId, warehouseId));

    return Number(total);
  }

  async canDeleteWarehouse(warehouseId: string): Promise<{ canDelete: boolean; reason?: string }> {
    const activeInventory = await this.countActiveInventory(warehouseId);
    if (activeInventory > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete warehouse holding active inventory (${activeInventory} units in stock)`,
      };
    }

    const assignedStaff = await this.countAssignedStaff(warehouseId);
    if (assignedStaff > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete warehouse with ${assignedStaff} assigned employee(s). Reassign staff first.`,
      };
    }

    return { canDelete: true };
  }
}
