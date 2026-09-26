import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsUUID,
  MaxLength,
  IsInt,
} from 'class-validator';
import { Transform, Type, type TransformFnParams } from 'class-transformer';

export class UpdateWarehouseDto {
  @IsString()
  @IsNotEmpty({ message: 'Warehouse name cannot be empty' })
  @MaxLength(255)
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  name?: string;

  @IsString()
  @IsNotEmpty({ message: 'Address cannot be empty' })
  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as string | undefined),
  )
  address?: string;

  @IsNumber({}, { message: 'Latitude must be a valid coordinate number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsNumber({}, { message: 'Longitude must be a valid coordinate number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsInt({ message: 'Geofence radius must be an integer in metres' })
  @Min(50, { message: 'Geofence radius must be at least 50 metres' })
  @Max(2000, { message: 'Geofence radius cannot exceed 2000 metres' })
  @IsOptional()
  @Type(() => Number)
  geofenceRadiusMeters?: number;

  @IsUUID('4', { message: 'Manager ID must be a valid UUID' })
  @IsOptional()
  managerId?: string;
}
