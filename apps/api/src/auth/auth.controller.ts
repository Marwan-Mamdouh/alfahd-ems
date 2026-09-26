import type { LoginResponseDto, RefreshTokenResponseDto } from '@alfahd/types';
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import {
  ForgotPasswordRequestDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  ResetPasswordRequestDto,
} from './dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RateLimitGuard } from './guards/rate-limit.guard.js';
import type { JwtUser } from './strategies/jwt.strategy.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  @HttpCode(200)
  login(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body() dto: RefreshTokenRequestDto,
    @Req() req: Request,
  ): Promise<RefreshTokenResponseDto> {
    return this.authService.refresh(dto.refreshToken, req.ip);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(@Req() req: Request & { user: JwtUser }): Promise<{ ok: true }> {
    await this.authService.logout(req.user.userId, req.user.tokenId);
    return { ok: true };
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordRequestDto): Promise<{ ok: true }> {
    await this.authService.forgotPassword(dto.email);
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<{ ok: true }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }
}
