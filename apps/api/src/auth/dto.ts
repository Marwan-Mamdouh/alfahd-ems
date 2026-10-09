import type {
  ForgotPasswordRequestDto as ForgotPasswordRequest,
  LoginRequestDto as LoginRequest,
  LoginResponseDto as LoginResponse,
  RefreshTokenRequestDto as RefreshTokenRequest,
  RefreshTokenResponseDto as RefreshTokenResponse,
  ResetPasswordRequestDto as ResetPasswordRequest,
} from '@alfahd/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { UserResponseDto } from '../users/dto.js';

export class LoginRequestDto implements LoginRequest {
  @ApiProperty({ example: 'admin@alfahd.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    minLength: 1,
    description: 'User account password',
  })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshTokenRequestDto implements RefreshTokenRequest {
  // Optional: web clients authenticate with the HTTP-only refresh cookie and send
  // no body. Mobile clients still send the token. The controller requires at
  // least one of the two, so an empty body is a 401 rather than a validation error.
  @ApiPropertyOptional({
    example: 'dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4...',
    description:
      'Refresh token string (required for mobile clients if HTTP-only cookie is not sent)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  refreshToken?: string;
}

export class ForgotPasswordRequestDto implements ForgotPasswordRequest {
  @ApiProperty({ example: 'admin@alfahd.com', description: 'Registered user email address' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordRequestDto implements ResetPasswordRequest {
  @ApiProperty({
    example: 'reset-token-abc-123',
    minLength: 1,
    description: 'Password reset token received via email',
  })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiProperty({
    example: 'BrandNewPassword123!',
    minLength: 8,
    description: 'New account password',
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class LoginResponseDto implements LoginResponse {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token for authorization headers',
  })
  accessToken!: string;

  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token returned in body for mobile clients',
  })
  refreshToken?: string;

  @ApiProperty({ type: () => UserResponseDto, description: 'Authenticated user profile' })
  user!: UserResponseDto;
}

export class RefreshTokenResponseDto implements RefreshTokenResponse {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'New JWT access token',
  })
  accessToken!: string;
}

export class AuthOkResponseDto {
  @ApiProperty({ example: true, description: 'Operation success flag' })
  ok!: true;
}
