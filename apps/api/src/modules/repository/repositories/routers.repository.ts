import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import * as schema from '../../../database/schema/index.js';
import {
  routers,
  type Router,
  type NewRouter,
  type RouterAssignment,
  type NewRouterAssignment,
  type RouterConditionHistory,
  type NewRouterConditionHistory,
} from '../../../database/schema/index.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';
import type { RouterStatus, RouterPhysicalCondition } from '@alfahd/types';

export interface RouterQueryParams {
  status?: RouterStatus;
  physicalCondition?: RouterPhysicalCondition;
  warehouseId?: string;
  productId?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface RouterWithDetails extends Router {
  product: {
    id: string;
    name: string;
    sku: string;
    model: string;
  };
  warehouse?: {
    id: string;
    name: string;
  } | null;
  activeAssignment?: RouterAssignment | null;
}

@Injectable()
export class RoutersRepository extends BaseRepository<
  Router,
  NewRouter,
  typeof routers,
  typeof schema
> {
  constructor(@Inject(DRIZZLE) protected override readonly db: NodePgDatabase<typeof schema>) {
    super(db, routers);
  }

  private getClient(tx?: NodePgDatabase<typeof schema>): NodePgDatabase<typeof schema> {
    return tx ?? this.db;
  }

  async findBySerialNumber(
    serialNumber: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<Router | undefined> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(schema.routers)
      .where(eq(schema.routers.serialNumber, serialNumber.trim()))
      .limit(1);

    return row;
  }

  override async findById(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Router | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(schema.routers)
      .where(eq(schema.routers.id, id))
      .limit(1);

    return row ?? null;
  }

  async createRouter(data: NewRouter, tx?: NodePgDatabase<typeof schema>): Promise<Router> {
    const client = this.getClient(tx);
    const [row] = await client.insert(schema.routers).values(data).returning();
    return row;
  }

  async updateRouter(
    id: string,
    data: Partial<NewRouter>,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<Router | undefined> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(schema.routers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.routers.id, id))
      .returning();

    return row;
  }

  async createAssignment(
    data: NewRouterAssignment,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterAssignment> {
    const client = this.getClient(tx);
    const [row] = await client.insert(schema.routerAssignments).values(data).returning();
    return row;
  }

  async findActiveAssignment(
    routerId: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterAssignment | undefined> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(schema.routerAssignments)
      .where(
        and(
          eq(schema.routerAssignments.routerId, routerId),
          // IS NULL check on releasedAt for currently active assignment
          eq(schema.routerAssignments.releasedAt, null as unknown as Date),
        ),
      )
      .limit(1);

    return row;
  }

  async releaseActiveAssignment(
    routerId: string,
    releasedAt: Date = new Date(),
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterAssignment | undefined> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(schema.routerAssignments)
      .set({ releasedAt })
      .where(
        and(
          eq(schema.routerAssignments.routerId, routerId),
          eq(schema.routerAssignments.releasedAt, null as unknown as Date),
        ),
      )
      .returning();

    return row;
  }

  async findAssignmentsByRouter(
    routerId: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterAssignment[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(schema.routerAssignments)
      .where(eq(schema.routerAssignments.routerId, routerId))
      .orderBy(desc(schema.routerAssignments.assignedAt));
  }

  async createConditionHistory(
    data: NewRouterConditionHistory,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterConditionHistory> {
    const client = this.getClient(tx);
    const [row] = await client.insert(schema.routerConditionHistory).values(data).returning();
    return row;
  }

  async findConditionHistory(
    routerId: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterConditionHistory[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(schema.routerConditionHistory)
      .where(eq(schema.routerConditionHistory.routerId, routerId))
      .orderBy(desc(schema.routerConditionHistory.createdAt));
  }

  async findManyWithPagination(
    params: RouterQueryParams,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<{ items: RouterWithDetails[]; total: number }> {
    const client = this.getClient(tx);
    const conditions: (SQL | undefined)[] = [];

    if (params.status) {
      conditions.push(eq(schema.routers.status, params.status));
    }
    if (params.physicalCondition) {
      conditions.push(eq(schema.routers.physicalCondition, params.physicalCondition));
    }
    if (params.warehouseId) {
      conditions.push(eq(schema.routers.warehouseId, params.warehouseId));
    }
    if (params.productId) {
      conditions.push(eq(schema.routers.productId, params.productId));
    }
    if (params.search) {
      const s = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.routers.serialNumber, s),
          ilike(schema.routers.notes, s),
          ilike(schema.routers.externalLocation, s),
        ),
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      client
        .select({
          router: schema.routers,
          product: {
            id: schema.products.id,
            name: schema.products.name,
            sku: schema.products.sku,
            model: schema.products.model,
          },
          warehouse: {
            id: schema.warehouses.id,
            name: schema.warehouses.name,
          },
        })
        .from(schema.routers)
        .innerJoin(schema.products, eq(schema.routers.productId, schema.products.id))
        .leftJoin(schema.warehouses, eq(schema.routers.warehouseId, schema.warehouses.id))
        .where(whereClause)
        .orderBy(desc(schema.routers.createdAt))
        .limit(params.limit)
        .offset(params.offset),
      client.select({ total: count() }).from(schema.routers).where(whereClause),
    ]);

    const items: RouterWithDetails[] = rows.map((r) => ({
      ...r.router,
      product: r.product,
      warehouse: r.warehouse?.id ? r.warehouse : null,
    }));

    return { items, total: Number(total) };
  }

  async getWarehouseRouterCounts(
    warehouseId: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<{ usable: number; damaged: number; underRepair: number; total: number }> {
    const client = this.getClient(tx);
    const rows = await client
      .select({
        status: schema.routers.status,
        condition: schema.routers.physicalCondition,
      })
      .from(schema.routers)
      .where(eq(schema.routers.warehouseId, warehouseId));

    let usable = 0;
    let damaged = 0;
    let underRepair = 0;

    for (const row of rows) {
      if (row.status === 'AVAILABLE' && row.condition === 'SERVICEABLE') {
        usable += 1;
      }
      if (row.condition === 'DAMAGED' || row.status === 'DAMAGED') {
        damaged += 1;
      }
      if (row.condition === 'UNDER_REPAIR' || row.status === 'UNDER_REPAIR') {
        underRepair += 1;
      }
    }

    return { usable, damaged, underRepair, total: rows.length };
  }
}
