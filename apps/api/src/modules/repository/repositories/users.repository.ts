import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../../database/schema/index.js';
import { users, type User } from '../../../database/schema/index.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class UsersRepository extends BaseRepository<
  User,
  typeof users.$inferInsert,
  typeof users,
  typeof schema
> {
  constructor(@Inject(DRIZZLE) protected override readonly db: NodePgDatabase<typeof schema>) {
    super(db, users);
  }

  private getClient(tx?: NodePgDatabase<typeof schema>): NodePgDatabase<typeof schema> {
    return tx ?? this.db;
  }

  override async findById(id: string, tx?: NodePgDatabase<typeof schema>): Promise<User | null> {
    const client = this.getClient(tx);
    const [row] = await client.select().from(users).where(eq(users.id, id));
    return row ?? null;
  }

  async findByIdForUpdate(id: string, tx?: NodePgDatabase<typeof schema>): Promise<User | null> {
    const client = this.getClient(tx);
    const [row] = await client.select().from(users).where(eq(users.id, id)).for('update');
    return row ?? null;
  }
}
