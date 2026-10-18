import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { DEPARTMENTS, Role, type Department, type CreateEmployeeDto } from '@alfahd/types';

export class CreateEmployeeRequestDto implements CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsIn([Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN])
  role: Role;

  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  hireDate?: string;

  @IsOptional()
  @IsUUID('4')
  assignedWarehouseId?: string;
}
