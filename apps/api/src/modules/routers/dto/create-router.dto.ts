import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  ROUTER_PHYSICAL_CONDITIONS,
  type RouterPhysicalCondition,
  type CreateRouterDto as ICreateRouterDto,
} from '@alfahd/types';

export class CreateRouterDto implements ICreateRouterDto {
  @ApiProperty({ description: 'Unique router hardware serial number', example: 'HW-RTR-998822' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  serialNumber!: string;

  @ApiProperty({
    description: 'Product / SKU catalog ID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Warehouse ID where the router is physically located' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional({
    description: 'Physical condition of the hardware',
    enum: ROUTER_PHYSICAL_CONDITIONS,
    default: 'SERVICEABLE',
  })
  @IsOptional()
  @IsEnum(ROUTER_PHYSICAL_CONDITIONS)
  physicalCondition?: RouterPhysicalCondition;

  @ApiPropertyOptional({
    description:
      'True = new inbound stock receipt (+1 quantity), False/Omitted = register existing warehouse unit (+0 quantity)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isNewReceipt?: boolean;

  @ApiPropertyOptional({ description: 'Optional operational notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
