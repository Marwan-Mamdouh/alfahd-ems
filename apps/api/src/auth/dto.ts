import type {
  ForgotPasswordRequestDto as ForgotPasswordRequest,
  LoginRequestDto as LoginRequest,
  RefreshTokenRequestDto as RefreshTokenRequest,
  ResetPasswordRequestDto as ResetPasswordRequest,
} from '@alfahd/types';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginRequestDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshTokenRequestDto implements RefreshTokenRequest {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
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
