import type {
  ChangePasswordRequestDto,
  CreateEmployeeDto,
  CreateUserDto,
  UpdateEmployeeDto,
  UpdateUserDto,
  UserDto,
  UserStatus,
} from '@alfahd/types';
import type { EmployeeQueryRequestDto } from '../employees/dto/employee-query.dto.js';
import { Role } from '@alfahd/types';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hash, verify } from 'argon2';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../database/database.module.js';
import { users, warehouses, type User } from '../database/schema/index.js';
import { ARGON2_OPTIONS, toUserDto } from '../database/schema/mappers.js';
import { EmailService } from '../email/email.service.js';
import { SessionService } from '../redis/session.service.js';
import { escapeHtml } from '../common/utils/html.utils.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
  ) {}

  public async findRowOrThrow(id: string): Promise<User> {
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
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await hash(dto.password, ARGON2_OPTIONS);
    const rows = await this.db
      .insert(users)
      .values({ email: dto.email.toLowerCase(), passwordHash, role: dto.role })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new BadRequestException('Failed to create user');
    }
    return toUserDto(created);
  }

  async createEmployee(dto: CreateEmployeeDto): Promise<User> {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('Email already in use');
    }

    if (dto.role === Role.TECHNICIAN && !dto.assignedWarehouseId) {
      throw new BadRequestException({
        code: 'TECHNICIAN_REQUIRES_WAREHOUSE',
        message: 'assignedWarehouseId is required when role is TECHNICIAN',
      });
    }

    if (dto.assignedWarehouseId) {
      const wh = await this.db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(eq(warehouses.id, dto.assignedWarehouseId))
        .limit(1);
      if (wh.length === 0) {
        throw new BadRequestException('Assigned warehouse not found');
      }
    }

    const tempPassword = `Temp-${randomBytes(6).toString('hex')}!Aa1`;
    const passwordHash = await hash(tempPassword, ARGON2_OPTIONS);

    const rows = await this.db
      .insert(users)
      .values({
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
        department: dto.department,
        phone: dto.phone,
        nationalId: dto.nationalId,
        hireDate: dto.hireDate,
        assignedWarehouseId: dto.assignedWarehouseId,
        status: 'ACTIVE',
        isActive: true,
      })
      .returning();

    const created = rows[0];
    if (!created) {
      throw new BadRequestException('Failed to create employee');
    }

    try {
      await this.emailService.send({
        to: dto.email.toLowerCase(),
        subject: 'Welcome to AlFahd EMS - Temporary Credentials',
        text: `Welcome to AlFahd EMS, ${dto.name}!\n\nYour account has been created with temporary password: ${tempPassword}\n\nPlease log in and update your password immediately.`,
        // dto.name is untrusted admin input: interpolating it unescaped would
        // allow HTML injection in the recipient's mail client (CWE-79).
        html: `<p>Welcome to AlFahd EMS, <strong>${escapeHtml(dto.name)}</strong>!</p><p>Your account has been created with temporary password: <code>${tempPassword}</code></p><p>Please log in and update your password immediately.</p>`,
      });
    } catch (error) {
      this.logger.warn(
        `Temporary credentials email delivery failed for ${dto.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return created;
  }

  async findEmployees(query: EmployeeQueryRequestDto): Promise<{ data: User[]; total: number }> {
    const offset = (query.page - 1) * query.pageSize;

    const conditions = [];

    if (query.role) {
      conditions.push(eq(users.role, query.role));
    }
    if (query.department) {
      conditions.push(eq(users.department, query.department));
    }
    if (query.status) {
      conditions.push(eq(users.status, query.status));
    }
    if (query.warehouse_id) {
      conditions.push(eq(users.assignedWarehouseId, query.warehouse_id));
    }
    if (query.q) {
      const search = `%${query.q}%`;
      conditions.push(or(ilike(users.name, search), ilike(users.email, search)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRows, data] = await Promise.all([
      this.db.select({ value: count() }).from(users).where(whereClause),
      this.db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(query.pageSize)
        .offset(offset),
    ]);

    const total = totalRows[0]?.value ? Number(totalRows[0].value) : 0;
    return { data, total };
  }

  async findEmployeeById(id: string): Promise<User> {
    return this.findRowOrThrow(id);
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto): Promise<User> {
    const user = await this.findRowOrThrow(id);

    if (dto.assignedWarehouseId) {
      const wh = await this.db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(eq(warehouses.id, dto.assignedWarehouseId))
        .limit(1);
      if (wh.length === 0) {
        throw new BadRequestException('Assigned warehouse not found');
      }
    }

    if (user.role === Role.TECHNICIAN && dto.assignedWarehouseId === null) {
      throw new BadRequestException({
        code: 'TECHNICIAN_REQUIRES_WAREHOUSE',
        message: 'Technicians must have an assigned warehouse',
      });
    }

    const rows = await this.db
      .update(users)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.assignedWarehouseId !== undefined
          ? { assignedWarehouseId: dto.assignedWarehouseId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new NotFoundException('Employee not found');
    }
    return updated;
  }

  async updateEmployeeStatus(id: string, status: UserStatus): Promise<User> {
    await this.findRowOrThrow(id);

    // Only INACTIVE deactivates the account flag. ON_LEAVE employees keep a
    // live account and valid sessions (spec: Acceptance Scenario 5); they are
    // simply not ACTIVE, so activity checks keyed on `status` (check-in,
    // assignment eligibility) already exclude them.
    const isActive = status !== 'INACTIVE';
    const rows = await this.db
      .update(users)
      .set({
        status,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new NotFoundException('Employee not found');
    }
    return updated;
  }

  async updateProfilePhotoKey(id: string, profilePhotoKey: string | null): Promise<User> {
    await this.findRowOrThrow(id);

    const rows = await this.db
      .update(users)
      .set({
        profilePhotoKey,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new NotFoundException('Employee not found');
    }
    return updated;
  }

  async findAll(): Promise<UserDto[]> {
    const rows = await this.db.select().from(users);
    return rows.map(toUserDto);
  }

  async findOne(id: string): Promise<UserDto> {
    return toUserDto(await this.findRowOrThrow(id));
  }

  async update(id: string, dto: UpdateUserDto, requestingUserId?: string): Promise<UserDto> {
    const user = await this.findRowOrThrow(id);
    // The self-deactivation guard belongs here (not in the controller) so any
    // caller of update({isActive: false}) enforces it. Missing
    // requestingUserId means an internal call, which skips the guard.
    if (dto.isActive === false && requestingUserId !== undefined && id === requestingUserId) {
      throw new BadRequestException('Admin cannot deactivate their own account');
    }
    if (dto.email !== undefined && dto.email !== user.email) {
      const existing = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, dto.email.toLowerCase()))
        .limit(1);
      if (existing.length > 0) {
        throw new ConflictException('Email already in use');
      }
    }
    const rows = await this.db
      .update(users)
      .set({
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
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
    // Deactivating an account must also terminate its live refresh sessions —
    // otherwise active sessions linger in Redis until natural expiry (the
    // employee-status flow already revokes; both paths live here in the
    // service rather than in the controller).
    if (dto.isActive === false) {
      await this.sessionService.revokeAllSessions(id);
    }
    return toUserDto(updated);
  }

  async deactivate(id: string, requestingUserId: string): Promise<UserDto> {
    if (id === requestingUserId) {
      throw new BadRequestException('Admin cannot deactivate their own account');
    }
    // Session revocation happens inside `update` (isActive === false).
    return this.update(id, { isActive: false }, requestingUserId);
  }

  async changePassword(userId: string, dto: ChangePasswordRequestDto): Promise<void> {
    const user = await this.findRowOrThrow(userId);
    if (!(await verify(user.passwordHash, dto.oldPassword))) {
      throw new BadRequestException('Old password is incorrect');
    }
    const passwordHash = await hash(dto.newPassword, ARGON2_OPTIONS);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    // A password change invalidates every pre-change session: refresh tokens
    // minted under the old credential must not outlive it by up to 7 days.
    await this.sessionService.revokeAllSessions(userId);
  }
}
