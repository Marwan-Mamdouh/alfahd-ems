import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import type { AttendanceRecordDto, AttendanceStatus } from '@alfahd/types';
import { Role } from '@alfahd/types';
import { DRIZZLE, type Db } from '../database/database.module.js';
import { attendanceRecords, users, warehouses } from '../database/schema/index.js';
import { haversineDistanceMeters } from '../common/utils/geo.utils.js';
import { ClockService, getLocalWorkDate, isAfterCutoff } from '../common/services/clock.service.js';
import type { OverrideAttendanceRequestDto } from './dto/override-attendance.dto.js';
import type { AttendanceQueryRequestDto } from './dto/attendance-query.dto.js';

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly configService: ConfigService,
    private readonly clockService: ClockService,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  async checkIn(userId: string, lat: number, lng: number): Promise<AttendanceRecordDto> {
    const userRows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.TECHNICIAN || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Only active technicians can check in');
    }

    if (!user.assignedWarehouseId) {
      throw new HttpException(
        {
          code: 'NO_ASSIGNED_WAREHOUSE',
          message: 'Technician has no assigned warehouse',
        },
        HttpStatus.CONFLICT,
      );
    }

    const warehouseRows = await this.db
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, user.assignedWarehouseId))
      .limit(1);
    const warehouse = warehouseRows[0];

    if (!warehouse || warehouse.gpsLat == null || warehouse.gpsLng == null) {
      throw new HttpException(
        {
          code: 'NO_ASSIGNED_WAREHOUSE',
          message: 'Assigned warehouse has no valid GPS coordinates',
        },
        HttpStatus.CONFLICT,
      );
    }

    const distance = haversineDistanceMeters(lat, lng, warehouse.gpsLat, warehouse.gpsLng);
    const allowedRadius = this.configService.get<number>('ATTENDANCE_RADIUS_M') ?? 150;
    const roundedDistance = Math.round(distance * 10) / 10;

    if (distance > allowedRadius) {
      throw new HttpException(
        {
          code: 'OUT_OF_RANGE',
          message: `Check-in coordinates are ${roundedDistance}m away from assigned warehouse (maximum ${allowedRadius}m allowed)`,
          details: { distanceM: roundedDistance, allowedRadiusM: allowedRadius },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = this.clockService.now();
    const timezone = this.configService.get<string>('APP_TIMEZONE') ?? 'Africa/Cairo';
    const workDate = getLocalWorkDate(now, timezone);

    // Verify unique check-in per day
    const existing = await this.db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.workDate, workDate)))
      .limit(1);

    if (existing.length > 0) {
      throw new HttpException(
        {
          code: 'ALREADY_CHECKED_IN',
          message: `Attendance record already exists for today (${workDate})`,
        },
        HttpStatus.CONFLICT,
      );
    }

    const cutoff = this.configService.get<string>('ATTENDANCE_CUTOFF_TIME') ?? '09:00';
    const isLate = isAfterCutoff(now, cutoff, timezone);
    const status: AttendanceStatus = isLate ? 'LATE' : 'ON_TIME';

    const rows = await this.db
      .insert(attendanceRecords)
      .values({
        userId,
        workDate,
        checkInAt: now,
        checkInLat: lat,
        checkInLng: lng,
        checkInDistanceM: roundedDistance,
        status,
      })
      .returning();

    const created = rows[0];
    return {
      id: created.id,
      workDate: created.workDate,
      checkInAt: created.checkInAt.toISOString(),
      checkInDistanceM: created.checkInDistanceM,
      status: created.status as AttendanceStatus,
    };
  }

  async checkOut(userId: string): Promise<AttendanceRecordDto> {
    const now = this.clockService.now();
    const timezone = this.configService.get<string>('APP_TIMEZONE') ?? 'Africa/Cairo';
    const workDate = getLocalWorkDate(now, timezone);

    const rows = await this.db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.workDate, workDate)))
      .limit(1);

    const record = rows[0];
    if (!record) {
      throw new HttpException(
        {
          code: 'NO_ACTIVE_CHECK_IN',
          message: 'No open check-in found for today',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (record.checkOutAt != null) {
      throw new HttpException(
        {
          code: 'ALREADY_CHECKED_OUT',
          message: 'Already checked out for today',
        },
        HttpStatus.CONFLICT,
      );
    }

    const updatedRows = await this.db
      .update(attendanceRecords)
      .set({
        checkOutAt: now,
        updatedAt: now,
      })
      .where(eq(attendanceRecords.id, record.id))
      .returning();

    const updated = updatedRows[0];
    const durationMs = now.getTime() - record.checkInAt.getTime();
    const hoursWorked = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

    return {
      id: updated.id,
      workDate: updated.workDate,
      checkInAt: updated.checkInAt.toISOString(),
      checkInDistanceM: updated.checkInDistanceM,
      checkOutAt: updated.checkOutAt!.toISOString(),
      status: updated.status as AttendanceStatus,
      hoursWorked,
    };
  }

  async override(
    id: string,
    adminId: string,
    dto: OverrideAttendanceRequestDto,
  ): Promise<AttendanceRecordDto> {
    const rows = await this.db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, id))
      .limit(1);

    const record = rows[0];
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    if (!dto.overrideReason || !dto.overrideReason.trim()) {
      throw new BadRequestException('overrideReason is strictly mandatory');
    }

    const now = this.clockService.now();
    const updatedRows = await this.db
      .update(attendanceRecords)
      .set({
        ...(dto.checkInAt ? { checkInAt: new Date(dto.checkInAt) } : {}),
        ...(dto.checkOutAt ? { checkOutAt: new Date(dto.checkOutAt) } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        overrideReason: dto.overrideReason,
        overriddenBy: adminId,
        overriddenAt: now,
        updatedAt: now,
      })
      .where(eq(attendanceRecords.id, id))
      .returning();

    const updated = updatedRows[0];
    return {
      id: updated.id,
      workDate: updated.workDate,
      checkInAt: updated.checkInAt.toISOString(),
      checkInDistanceM: updated.checkInDistanceM,
      checkOutAt: updated.checkOutAt?.toISOString() ?? null,
      status: updated.status as AttendanceStatus,
      overrideReason: updated.overrideReason,
      overriddenBy: updated.overriddenBy,
      overriddenAt: updated.overriddenAt?.toISOString() ?? null,
    };
  }

  async enqueueReport(
    dto: AttendanceQueryRequestDto,
    requestedBy: string,
  ): Promise<{ jobId: string }> {
    if (!dto.from || !dto.to) {
      throw new BadRequestException('Both "from" and "to" date parameters are required');
    }

    const fromDate = new Date(dto.from);
    const toDate = new Date(dto.to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date format for "from" or "to"');
    }

    if (fromDate > toDate) {
      throw new BadRequestException('"from" date must be earlier than "to" date');
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 366) {
      throw new HttpException(
        {
          code: 'DATE_RANGE_EXCEEDS_MAXIMUM',
          message: 'Date range cannot exceed 12 months (366 days)',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const job = await this.reportsQueue.add('attendance-summary', {
      type: 'ATTENDANCE_SUMMARY',
      params: dto,
      requestedBy,
    });

    return { jobId: String(job.id) };
  }
}
