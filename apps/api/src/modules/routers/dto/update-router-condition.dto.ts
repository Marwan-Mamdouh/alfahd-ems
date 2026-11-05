import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  ROUTER_PHYSICAL_CONDITIONS,
  type RouterPhysicalCondition,
  type UpdateRouterConditionDto as IUpdateRouterConditionDto,
} from '@alfahd/types';

export class UpdateRouterConditionDto implements IUpdateRouterConditionDto {
  @ApiProperty({
    description: 'Updated hardware physical condition',
    enum: ROUTER_PHYSICAL_CONDITIONS,
  })
  @IsEnum(ROUTER_PHYSICAL_CONDITIONS)
  @IsNotEmpty()
  physicalCondition!: RouterPhysicalCondition;

  @ApiPropertyOptional({ description: 'Updated warehouse location if moving or repairing' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'External location description (e.g. third-party repair shop)',
  })
  @IsOptional()
  @IsString()
  externalLocation?: string;

  @ApiProperty({ description: 'Mandatory reason for recording condition change' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
