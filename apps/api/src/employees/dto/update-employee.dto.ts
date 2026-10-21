import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DEPARTMENTS, type Department, type UpdateEmployeeDto } from '@alfahd/types';

export class UpdateEmployeeRequestDto implements UpdateEmployeeDto {
  // users.name is varchar(255) — mirror the create DTO so an over-long update
  // cannot trigger `value too long for type character varying(255)` (500).
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  // users.phone is varchar(30) — mirror the create DTO so an over-long update
  // cannot trigger `value too long for type character varying(30)` (500).
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsUUID('4')
  assignedWarehouseId?: string;
}
