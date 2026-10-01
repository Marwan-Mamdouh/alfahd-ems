import type {
  ForgotPasswordRequestDto as ForgotPasswordRequest,
  LoginRequestDto as LoginRequest,
  RefreshTokenRequestDto as RefreshTokenRequest,
  ResetPasswordRequestDto as ResetPasswordRequest,
} from '@alfahd/types';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginRequestDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshTokenRequestDto implements RefreshTokenRequest {
  // Optional: web clients authenticate with the HTTP-only refresh cookie and send
  // no body. Mobile clients still send the token. The controller requires at
  // least one of the two, so an empty body is a 401 rather than a validation error.
  @IsOptional()
  @IsString()
  @MinLength(1)
  refreshToken?: string;
}

export class ForgotPasswordRequestDto implements ForgotPasswordRequest {
  @IsEmail()
  email!: string;
}

export class ResetPasswordRequestDto implements ResetPasswordRequest {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
