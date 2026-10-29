import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, ilike, or, and, count, sum, type SQL } from 'drizzle-orm';
import * as schema from '../../../database/schema/index.js';
import { warehouses } from '../../../database/schema/index.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  Warehouse,
} from '../../warehouses/warehouse.types.js';

type WarehouseRow = typeof schema.warehouses.$inferSelect;
type NewWarehouseRow = typeof schema.warehouses.$inferInsert;

function toWarehouse(row: WarehouseRow): Warehouse {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? '',
    latitude: row.gpsLat ?? 0,
    longitude: row.gpsLng ?? 0,
    geofenceRadiusMeters: row.geofenceRadiusMeters,
    managerId: row.managerId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface QueryWarehousesParams {
  search?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class WarehousesRepository extends BaseRepository<
  Warehouse,
  CreateWarehouseInput,
  typeof warehouses,
  typeof schema
> {
  constructor(@Inject(DRIZZLE) protected override readonly db: NodePgDatabase<typeof schema>) {
    super(db, warehouses);
  }

  override async findAll(): Promise<Warehouse[]> {
    const rows = await this.db.select().from(schema.warehouses);
    return rows.map(toWarehouse);
  }

  override async findById(id: string): Promise<Warehouse | null> {
    const [row] = await this.db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.id, id))
      .limit(1);

    return row ? toWarehouse(row) : null;
  }

  override async create(
    data: Omit<CreateWarehouseInput, 'id'> & Partial<{ id: string }>,
  ): Promise<Warehouse> {
    const values: NewWarehouseRow = {
      id: data.id,
      name: data.name,
      address: data.address,
      gpsLat: data.latitude,
      gpsLng: data.longitude,
      geofenceRadiusMeters: data.geofenceRadiusMeters ?? 150,
      managerId: data.managerId ?? null,
    };

    const [row] = await this.db.insert(schema.warehouses).values(values).returning();
    return toWarehouse(row);
  }

  async findByName(name: string): Promise<Warehouse | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.name, name.trim()))
      .limit(1);

    return row ? toWarehouse(row) : undefined;
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

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.warehouses)
        .where(whereClause)
        .limit(params.limit)
        .offset(params.offset),
      this.db.select({ total: count() }).from(schema.warehouses).where(whereClause),
    ]);

    return { items: rows.map(toWarehouse), total: Number(total) };
  }

  async updateWarehouse(id: string, updates: UpdateWarehouseInput): Promise<Warehouse | undefined> {
    const values: Partial<NewWarehouseRow> = {};

    if (updates.name !== undefined) values.name = updates.name;
    if (updates.address !== undefined) values.address = updates.address;
    if (updates.latitude !== undefined) values.gpsLat = updates.latitude;
    if (updates.longitude !== undefined) values.gpsLng = updates.longitude;
    if (updates.geofenceRadiusMeters !== undefined) {
      values.geofenceRadiusMeters = updates.geofenceRadiusMeters;
    }
    if (updates.managerId !== undefined) values.managerId = updates.managerId;

    const [updated] = await this.db
      .update(schema.warehouses)
      .set(values)
      .where(eq(schema.warehouses.id, id))
      .returning();

    return updated ? toWarehouse(updated) : undefined;
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

  async countPhysicallyLocatedRouters(warehouseId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.routers)
      .where(eq(schema.routers.warehouseId, warehouseId));

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

    const physicallyLocatedRouters = await this.countPhysicallyLocatedRouters(warehouseId);
    if (physicallyLocatedRouters > 0) {
      return {
        canDelete: false,
        reason: `Cannot deactivate warehouse with ${physicallyLocatedRouters} physically located router(s). Relocate routers first.`,
      };
    }

    return { canDelete: true };
  }

  async softDeactivate(id: string): Promise<Warehouse | undefined> {
    const [updated] = await this.db
      .update(schema.warehouses)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.warehouses.id, id))
      .returning();

    return updated ? toWarehouse(updated) : undefined;
  }
}
