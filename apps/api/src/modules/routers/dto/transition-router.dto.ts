import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({
    description: 'Mandatory operational reason for manual overrides/transitions',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Target warehouse ID when returning or moving to warehouse' })
  @IsOptional()
  @IsUUID()
  targetWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Optional operational notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
