import type {
  ChangePasswordRequestDto as ChangePasswordRequest,
  CreateUserDto as CreateUserRequest,
  UpdateUserDto as UpdateUserRequest,
  UserDto,
} from '@alfahd/types';
import { Role } from '@alfahd/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UserResponseDto implements UserDto {
  @ApiProperty({ example: 'a0000000-0000-0000-0000-000000000001', description: 'User unique ID' })
  id!: string;

  @ApiProperty({ example: 'admin@alfahd.com', description: 'User email address' })
  email!: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.ADMIN, description: 'User role' })
  role!: Role;

  @ApiProperty({ example: true, description: 'Whether the user account is active' })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', description: 'Account creation timestamp' })
  createdAt!: string;
}

export class CreateUserRequestDto implements CreateUserRequest {
  @ApiProperty({ example: 'tech1@alfahd.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'P@ssword123', minLength: 8, description: 'Initial user password' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    enum: Role,
    enumName: 'Role',
    example: Role.TECHNICIAN,
    description: 'User role assigned to this account',
  })
  @IsEnum(Role)
  role!: Role;
}

export class UpdateUserRequestDto implements UpdateUserRequest {
  @ApiPropertyOptional({
    example: 'tech1_updated@alfahd.com',
    description: 'Updated email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    enum: Role,
    enumName: 'Role',
    example: Role.TECHNICIAN,
    description: 'Updated user role',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: false, description: 'Soft-deactivation flag' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ChangePasswordRequestDto implements ChangePasswordRequest {
  @ApiProperty({ example: 'OldPassword123!', minLength: 1, description: 'Current user password' })
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @ApiProperty({ example: 'NewSecurePassword123!', minLength: 8, description: 'New password' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class RevokeSessionResponseDto {
  @ApiProperty({ example: true, description: 'Operation success flag' })
  ok!: true;

  @ApiProperty({ example: 2, description: 'Number of active sessions revoked' })
  revoked!: number;
}
