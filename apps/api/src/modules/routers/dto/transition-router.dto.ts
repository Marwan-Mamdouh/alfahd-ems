import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ROUTER_STATUSES,
  type RouterStatus,
  type TransitionRouterDto as ITransitionRouterDto,
} from '@alfahd/types';

export class TransitionRouterDto implements ITransitionRouterDto {
  @ApiProperty({
    description: 'Target lifecycle status according to the approved whitelist',
    enum: ROUTER_STATUSES,
  })
  @IsEnum(ROUTER_STATUSES)
  @IsNotEmpty()
  status!: RouterStatus;

  @ApiProperty({
    description: 'Mandatory operational reason for manual overrides/transitions',
    example: 'Hardware damaged during deployment inspection',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Reason is required and cannot be empty' })
  reason!: string;

  @ApiPropertyOptional({ description: 'Target warehouse ID when returning or moving to warehouse' })
  @IsOptional()
  @IsUUID()
  targetWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Optional operational notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
