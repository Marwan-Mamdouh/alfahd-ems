import { IsString, IsNotEmpty, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { Transform, Type, type TransformFnParams } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  @MaxLength(255)
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'SKU is required' })
  @MaxLength(100)
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toUpperCase() : (value as string),
  )
  sku!: string;

  @IsString()
  @IsNotEmpty({ message: 'Model is required' })
  @MaxLength(255)
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  model!: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  @MaxLength(100)
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  category!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  description?: string;

  @IsInt({ message: 'Low stock threshold must be an integer' })
  @Min(0, { message: 'Low stock threshold cannot be negative' })
  @IsOptional()
  @Type(() => Number)
  lowStockThreshold?: number = 10;
}
