import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Role } from '@alfahd/types';
import * as schema from '../../../database/schema/index.js';
import { users, type User } from '../../../database/schema/index.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';

/**
 * Shared domain validator ensuring an employee exists, has TECHNICIAN role,
 * and is currently ACTIVE. Used across inventory and router operations to prevent drift.
 */
export function validateActiveTechnician(
  technician: User | null | undefined,
  technicianId: string,
  actionDescription = 'mutate stock or routers',
): User {
  if (!technician) {
    throw new NotFoundException(`Technician with ID "${technicianId}" was not found`);
  }
  if (technician.role !== Role.TECHNICIAN) {
    throw new BadRequestException(
      `Employee with ID "${technicianId}" does not have role TECHNICIAN (Role: ${technician.role})`,
    );
  }
  if (technician.status !== 'ACTIVE' || !technician.isActive) {
    throw new ConflictException(
      `Cannot ${actionDescription} for technician "${technician.name}" because status is ${technician.status}`,
    );
  }
  return technician;
}

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

  /**
   * Revalidates technician existence, TECHNICIAN role, and ACTIVE status under transaction lock.
   */
  async ensureActiveTechnician(
    technicianId: string,
    tx?: NodePgDatabase<typeof schema>,
    actionDescription = 'mutate stock or routers',
  ): Promise<User> {
    const technician = await this.findByIdForUpdate(technicianId, tx);
    return validateActiveTechnician(technician, technicianId, actionDescription);
  }
}
