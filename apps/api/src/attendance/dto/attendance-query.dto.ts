import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { DEPARTMENTS, type AttendanceQueryDto, type Department } from '@alfahd/types';

export class AttendanceQueryRequestDto implements AttendanceQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  @IsOptional()
  @IsUUID('4')
  employee_id?: string;
}
