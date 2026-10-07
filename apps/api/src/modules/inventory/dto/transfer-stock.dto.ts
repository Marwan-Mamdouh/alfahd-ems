import { IsUUID, IsInt, Min, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferStockDto {
  @IsUUID('4', { message: 'Source warehouse ID must be a valid UUID' })
  fromWarehouseId!: string;

  @IsUUID('4', { message: 'Destination warehouse ID must be a valid UUID' })
  toWarehouseId!: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  productId!: string;

  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Transfer quantity must be at least 1' })
  @Type(() => Number)
  quantity!: number;

  @IsUUID('4', { message: 'Responsible user ID must be a valid UUID' })
  @IsOptional()
  responsibleUserId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
