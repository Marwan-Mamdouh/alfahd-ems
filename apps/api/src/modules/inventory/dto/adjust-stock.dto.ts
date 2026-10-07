import { IsUUID, IsInt, Min, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Transform, Type, type TransformFnParams } from 'class-transformer';

export class AdjustStockDto {
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID' })
  warehouseId!: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  productId!: string;

  @IsInt({ message: 'Target quantity must be an integer' })
  @Min(0, { message: 'Adjusted physical quantity cannot be negative' })
  @Type(() => Number)
  newQuantity!: number;

  @IsString()
  @IsNotEmpty({ message: 'Mandatory justification notes required for audit adjustments' })
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  notes!: string;

  @IsUUID('4', { message: 'Responsible user ID must be a valid UUID' })
  @IsOptional()
  responsibleUserId?: string;
}
