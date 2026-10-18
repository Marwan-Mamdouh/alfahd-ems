import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DEPARTMENTS, type Department, type UpdateEmployeeDto } from '@alfahd/types';

export class UpdateEmployeeRequestDto implements UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: Department;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID('4')
  assignedWarehouseId?: string;
}
