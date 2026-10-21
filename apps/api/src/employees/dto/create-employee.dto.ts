import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DEPARTMENTS, Role, type Department, type CreateEmployeeDto } from '@alfahd/types';

export class CreateEmployeeRequestDto implements CreateEmployeeDto {
  // users.name is varchar(255): without MaxLength an over-long value reaches
  // Postgres and fails with a 500 instead of a 400.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  email: string;

  @IsIn([Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN])
  role: Role;

  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  // users.phone / users.national_id are varchar(30): without MaxLength an
  // over-long value reaches Postgres and fails with a 500 instead of a 400.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nationalId?: string;

  // users.hire_date is a `date` column: `@IsString()` would let "not-a-date"
  // through to a Postgres date-parse error (500).
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsUUID('4')
  assignedWarehouseId?: string;
}
