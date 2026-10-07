import { IsUUID, IsInt, Min, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class OutboundStockDto {
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID' })
  warehouseId!: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  productId!: string;

  @IsUUID('4', { message: 'Technician ID must be a valid UUID' })
  technicianId!: string;

  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Outbound quantity must be at least 1' })
  @Type(() => Number)
  quantity!: number;

  @IsUUID('4', { message: 'Responsible user ID must be a valid UUID' })
  @IsOptional()
  responsibleUserId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
