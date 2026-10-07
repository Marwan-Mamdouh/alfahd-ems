import { IsUUID, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { stockMovementTypeEnum } from '../../../entities/enums.js';

export class QueryStockMovementsDto {
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID' })
  @IsOptional()
  warehouseId?: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  @IsOptional()
  productId?: string;

  @IsEnum(stockMovementTypeEnum.enumValues, {
    message: `Movement type must be one of: ${stockMovementTypeEnum.enumValues.join(', ')}`,
  })
  @IsOptional()
  movementType?: (typeof stockMovementTypeEnum.enumValues)[number];

  @IsUUID('4', { message: 'Technician ID must be a valid UUID' })
  @IsOptional()
  technicianId?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit: number = 20;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset: number = 0;
}
