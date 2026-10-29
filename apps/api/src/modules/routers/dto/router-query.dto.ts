import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import {
  ROUTER_STATUSES,
  ROUTER_PHYSICAL_CONDITIONS,
  type RouterStatus,
  type RouterPhysicalCondition,
  type RouterQueryDto as IRouterQueryDto,
} from '@alfahd/types';

export class RouterQueryDto implements IRouterQueryDto {
  @ApiPropertyOptional({ enum: ROUTER_STATUSES })
  @IsOptional()
  @IsEnum(ROUTER_STATUSES)
  status?: RouterStatus;

  @ApiPropertyOptional({ enum: ROUTER_PHYSICAL_CONDITIONS })
  @IsOptional()
  @IsEnum(ROUTER_PHYSICAL_CONDITIONS)
  physicalCondition?: RouterPhysicalCondition;

  @ApiPropertyOptional({ description: 'Filter by physical warehouse location' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Filter by product SKU ID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Search by serial number, notes, or location' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
