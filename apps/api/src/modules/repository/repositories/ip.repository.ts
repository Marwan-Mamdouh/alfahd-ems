import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import * as schema from '../../../database/schema/index.js';
import {
  ipAddresses,
  type IpAddress,
  type NewIpAddress,
  type IpHistory,
  type NewIpHistory,
} from '../../../database/schema/index.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';
import type { IpStatus } from '@alfahd/types';

export interface IpQueryParams {
  status?: IpStatus;
  isArchived?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class IpRepository extends BaseRepository<
  IpAddress,
  NewIpAddress,
  typeof ipAddresses,
  typeof schema
> {
  constructor(@Inject(DRIZZLE) protected override readonly db: NodePgDatabase<typeof schema>) {
    super(db, ipAddresses);
  }

  private getClient(tx?: NodePgDatabase<typeof schema>): NodePgDatabase<typeof schema> {
    return tx ?? this.db;
  }

  async findByAddress(
    address: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<IpAddress | undefined> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(schema.ipAddresses)
      .where(eq(schema.ipAddresses.address, address.trim()))
      .limit(1);

    return row;
  }

  override async findById(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<IpAddress | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(schema.ipAddresses)
      .where(eq(schema.ipAddresses.id, id))
      .limit(1);

    return row ?? null;
  }

  async createIp(data: NewIpAddress, tx?: NodePgDatabase<typeof schema>): Promise<IpAddress> {
    const client = this.getClient(tx);
    const [row] = await client.insert(schema.ipAddresses).values(data).returning();
    return row;
  }

  async updateIp(
    id: string,
    data: Partial<NewIpAddress>,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<IpAddress | undefined> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(schema.ipAddresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.ipAddresses.id, id))
      .returning();

    return row;
  }

  async createHistory(data: NewIpHistory, tx?: NodePgDatabase<typeof schema>): Promise<IpHistory> {
    const client = this.getClient(tx);
    const [row] = await client.insert(schema.ipHistory).values(data).returning();
    return row;
  }

  async findHistoryByIp(ipId: string, tx?: NodePgDatabase<typeof schema>): Promise<IpHistory[]> {
    const client = this.getClient(tx);
    return client
      .select()
      .from(schema.ipHistory)
      .where(eq(schema.ipHistory.ipId, ipId))
      .orderBy(desc(schema.ipHistory.createdAt));
  }

  async findManyWithPagination(
    params: IpQueryParams,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<{ items: IpAddress[]; total: number }> {
    const client = this.getClient(tx);
    const conditions: (SQL | undefined)[] = [];

    if (params.status) {
      conditions.push(eq(schema.ipAddresses.status, params.status));
    }
    if (params.isArchived !== undefined) {
      conditions.push(eq(schema.ipAddresses.isArchived, params.isArchived));
    }
    if (params.search) {
      const s = `%${params.search.trim()}%`;
      conditions.push(or(ilike(schema.ipAddresses.address, s), ilike(schema.ipAddresses.notes, s)));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [items, [{ total }]] = await Promise.all([
      client
        .select()
        .from(schema.ipAddresses)
        .where(whereClause)
        .orderBy(desc(schema.ipAddresses.createdAt))
        .limit(params.limit)
        .offset(params.offset),
      client.select({ total: count() }).from(schema.ipAddresses).where(whereClause),
    ]);

    return { items, total: Number(total) };
  }
}
