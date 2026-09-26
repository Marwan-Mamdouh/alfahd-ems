import { randomUUID } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { BaseEntity } from '../../../entities/base.entity.js';

export abstract class BaseRepository<
  TSelect extends BaseEntity,
  TInsert extends Record<string, unknown> = Record<string, unknown>,
  TTable extends PgTable = PgTable,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> {
  protected constructor(
    protected readonly db: NodePgDatabase<TSchema>,
    protected readonly table: TTable,
  ) {}

  async findAll(): Promise<TSelect[]> {
    const results = await this.db.select().from(this.table as PgTable);
    return results as unknown as TSelect[];
  }

  async findById(id: string): Promise<TSelect | null> {
    const columns = getTableColumns(this.table);
    const [result] = await this.db
      .select()
      .from(this.table as PgTable)
      .where(eq(columns.id, id));

    return (result as unknown as TSelect) ?? null;
  }

  async create(data: Omit<TInsert, 'id'> & Partial<Pick<TInsert, 'id'>>): Promise<TSelect> {
    const id = (data as { id?: string }).id ?? randomUUID();
    const values = { ...data, id };
    const [result] = await this.db
      .insert(this.table as PgTable)
      .values(values as never)
      .returning();

    return result as unknown as TSelect;
  }

  async deleteById(id: string): Promise<void> {
    const columns = getTableColumns(this.table);
    await this.db.delete(this.table as PgTable).where(eq(columns.id, id));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(this.table as PgTable);
  }
}
