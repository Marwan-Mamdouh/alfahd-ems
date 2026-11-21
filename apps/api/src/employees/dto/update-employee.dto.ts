import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { DEPARTMENTS, type Department, type UpdateEmployeeDto } from '@alfahd/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CALENDAR_DATE_PATTERN } from '../../common/utils/date.utils.js';

export class UpdateEmployeeRequestDto implements UpdateEmployeeDto {
  // users.name is varchar(255) — mirror the create DTO so an over-long update
  // cannot trigger `value too long for type character varying(255)` (500).
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  // users.phone is varchar(30) — mirror the create DTO so an over-long update
  // cannot trigger `value too long for type character varying(30)` (500).
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @ApiPropertyOptional({ format: 'date', example: '2026-01-15' })
  @Matches(CALENDAR_DATE_PATTERN)
  @IsDateString({ strict: true })
  hireDate?: string;

  @IsOptional()
  @IsUUID('4')
  assignedWarehouseId?: string;
}
