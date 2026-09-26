import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform, Type, type TransformFnParams } from 'class-transformer';

export class QueryWarehousesDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  search?: string;

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
