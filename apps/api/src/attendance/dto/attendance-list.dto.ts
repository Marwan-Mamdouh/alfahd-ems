import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ATTENDANCE_STATUSES,
  DEPARTMENTS,
  type AttendanceListQueryDto,
  type AttendanceStatus,
  type Department,
} from '@alfahd/types';

export class AttendanceListRequestDto implements AttendanceListQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Inclusive local work date (YYYY-MM-DD)',
  })
  @IsOptional()
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Inclusive local work date (YYYY-MM-DD)',
  })
  @IsOptional()
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Employee UUID v4; nonexistent employees return 404',
  })
  @IsOptional()
  @IsUUID('4')
  employee_id?: string;

  @ApiPropertyOptional({ enum: DEPARTMENTS, description: 'Current employee department' })
  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  @ApiPropertyOptional({ enum: ATTENDANCE_STATUSES })
  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 2147483647 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class AttendanceListItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() employeeName!: string;
  @ApiProperty({ enum: DEPARTMENTS, nullable: true }) department!: Department | null;
  @ApiProperty({ format: 'date' }) workDate!: string;
  @ApiProperty({ format: 'date-time' }) checkInAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) checkOutAt!: string | null;
  @ApiProperty() checkInDistanceM!: number;
  @ApiProperty({ type: Number, nullable: true }) hoursWorked!: number | null;
  @ApiProperty({ enum: ATTENDANCE_STATUSES }) status!: AttendanceStatus;
  @ApiProperty({ type: String, nullable: true }) overrideReason!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) overriddenBy!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) overriddenAt!: string | null;
}

export class AttendanceTotalsResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty() onTime!: number;
  @ApiProperty() late!: number;
}

export class AttendanceListResponseDto {
  @ApiProperty({ type: [AttendanceListItemResponseDto] }) items!: AttendanceListItemResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty({ description: 'Count after all filters, before pagination' })
  filteredTotal!: number;
  @ApiProperty({
    type: AttendanceTotalsResponseDto,
    description: 'Counts before status and pagination filters',
  })
  totals!: AttendanceTotalsResponseDto;
}
