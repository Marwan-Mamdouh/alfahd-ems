import { IsString, IsNotEmpty, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { Transform, Type, type TransformFnParams } from 'class-transformer';

export class UpdateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Product name cannot be empty' })
  @MaxLength(255)
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  name?: string;

  @IsString()
  @IsNotEmpty({ message: 'SKU cannot be empty' })
  @MaxLength(100)
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toUpperCase() : (value as string | undefined),
  )
  sku?: string;

  @IsString()
  @IsNotEmpty({ message: 'Model cannot be empty' })
  @MaxLength(255)
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  model?: string;

  @IsString()
  @IsNotEmpty({ message: 'Category cannot be empty' })
  @MaxLength(100)
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  category?: string;

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
  lowStockThreshold?: number;
}
