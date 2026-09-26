import type {
  ChangePasswordRequestDto as ChangePasswordRequest,
  CreateUserDto as CreateUserRequest,
  UpdateUserDto as UpdateUserRequest,
} from '@alfahd/types';
import { Role } from '@alfahd/types';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserRequestDto implements CreateUserRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(Role)
  role!: Role;
}

export class UpdateUserRequestDto implements UpdateUserRequest {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  isActive?: boolean;
}

export class ChangePasswordRequestDto implements ChangePasswordRequest {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
