import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Transform, Type, type TransformFnParams } from 'class-transformer';

export class QueryProductsDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  search?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  category?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }: TransformFnParams) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value as boolean | undefined;
  })
  isLowStock?: boolean;

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
