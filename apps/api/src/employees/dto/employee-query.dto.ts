import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  DEPARTMENTS,
  Role,
  USER_STATUSES,
  type Department,
  type UserStatus,
  type EmployeeQueryDto,
} from '@alfahd/types';

export class EmployeeQueryRequestDto implements EmployeeQueryDto {
  @IsOptional()
  @IsIn([Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN])
  role?: Role;

  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus;

  @IsOptional()
  @IsUUID('4')
  warehouse_id?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
