import { IsDateString, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { DEPARTMENTS, type AttendanceQueryDto, type Department } from '@alfahd/types';
import { CALENDAR_DATE_PATTERN } from '../../common/utils/date.utils.js';

export class AttendanceQueryRequestDto implements AttendanceQueryDto {
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN)
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  @IsOptional()
  @IsUUID('4')
  employee_id?: string;
}
