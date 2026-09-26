import type {
  ChangePasswordRequestDto,
  CreateUserDto,
  UpdateUserDto,
  UserDto,
} from '@alfahd/types';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../database/database.module.js';
import { users, type User } from '../database/schema/index.js';
import { BCRYPT_COST, toUserDto } from '../auth/auth.service.js';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  private async findRowOrThrow(id: string): Promise<User> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await hash(dto.password, BCRYPT_COST);
    const rows = await this.db
      .insert(users)
      .values({ email: dto.email, passwordHash, role: dto.role })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new BadRequestException('Failed to create user');
    }
    return toUserDto(created);
  }

  async findAll(): Promise<UserDto[]> {
    const rows = await this.db.select().from(users);
    return rows.map(toUserDto);
  }

  async findOne(id: string): Promise<UserDto> {
    return toUserDto(await this.findRowOrThrow(id));
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.findRowOrThrow(id);
    if (dto.email !== undefined && dto.email !== user.email) {
      const existing = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, dto.email))
        .limit(1);
      if (existing.length > 0) {
        throw new ConflictException('Email already in use');
      }
    }
    const rows = await this.db
      .update(users)
      .set({
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return toUserDto(updated);
  }

  async deactivate(id: string, requestingUserId: string): Promise<UserDto> {
    if (id === requestingUserId) {
      throw new BadRequestException('Admin cannot deactivate their own account');
    }
    return this.update(id, { isActive: false });
  }

  async changePassword(userId: string, dto: ChangePasswordRequestDto): Promise<void> {
    const user = await this.findRowOrThrow(userId);
    if (!(await compare(dto.oldPassword, user.passwordHash))) {
      throw new BadRequestException('Old password is incorrect');
    }
    const passwordHash = await hash(dto.newPassword, BCRYPT_COST);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}
