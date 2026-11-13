import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, USER_STATUSES, type UserStatus, type EmployeeLookupQueryDto } from '@alfahd/types';

export class EmployeeLookupQueryRequestDto implements EmployeeLookupQueryDto {
  @ApiPropertyOptional({ enum: [Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN] })
  @IsOptional()
  @IsIn([Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN])
  role?: Role;

  @ApiPropertyOptional({ description: 'Filter by assigned warehouse UUID' })
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Wire alias for warehouseId for backward compatibility',
    deprecated: true,
  })
  @IsOptional()
  @IsUUID('4')
  warehouse_id?: string;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search query matching employee name' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Max number of results (1..100, default 50)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
