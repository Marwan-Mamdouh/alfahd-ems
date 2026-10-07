import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryInventoryDto {
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID' })
  @IsOptional()
  warehouseId?: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  @IsOptional()
  productId?: string;

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
