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

  /**
   * Bounds (1..100) are enforced here so the DTO is the single source of truth
   * for pagination: services must not re-clamp.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
