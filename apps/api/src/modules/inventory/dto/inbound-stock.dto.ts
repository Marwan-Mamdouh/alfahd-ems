import { IsUUID, IsInt, Min, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Transform, Type, type TransformFnParams } from 'class-transformer';

export class InboundStockDto {
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID' })
  warehouseId!: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  productId!: string;

  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Inbound quantity must be at least 1' })
  @Type(() => Number)
  quantity!: number;

  @IsString()
  @IsNotEmpty({ message: 'Supplier name is required for inbound stock' })
  @MaxLength(255)
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  supplierName!: string;

  @IsUUID('4', { message: 'Responsible user ID must be a valid UUID' })
  @IsOptional()
  responsibleUserId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
