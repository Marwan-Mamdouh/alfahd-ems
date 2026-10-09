import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  AuthOkResponseDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenRequestDto,
  RefreshTokenResponseDto,
  ResetPasswordRequestDto,
} from './dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RateLimitGuard } from './guards/rate-limit.guard.js';
import type { JwtUser } from './strategies/jwt.strategy.js';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  refreshCookieOptions,
} from '../config/refresh-cookie.js';

// `cookies` is populated by cookie-parser and already typed by @types/cookie-parser.
type CookieRequest = Request;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate user and issue tokens' })
  @ApiOkResponse({ description: 'Authentication successful', type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid email or password input' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto.email, dto.password);

    // Deliver the refresh token as an HTTP-only cookie so it is unreachable from
    // JavaScript. The body copy stays for mobile clients, which have no cookie
    // jar and keep the token in secure storage.
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, this.cookieOptions());

    return result;
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie or body' })
  @ApiOkResponse({
    description: 'Access token refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing refresh token' })
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    // Cookie first (web), body second (mobile). Neither present is a 401 rather
    // than a validation error, so an expired-cookie reload fails cleanly.
    const token = req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      return await this.authService.refresh(token, req.ip);
    } catch (error) {
      // Clear a REJECTED cookie. `httpOnly` means JavaScript cannot delete it,
      // and `POST /auth/logout` — the only other thing that clears it — needs a
      // valid access token, which the caller does not have here. Leaving a dead
      // cookie in the browser traps the web client: the middleware guard sees the
      // cookie and bounces every navigation to /dashboard, while every API call
      // 401s, so the user can never reach the login form.
      if (error instanceof UnauthorizedException) {
        res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
      }
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out and invalidate session' })
  @ApiOkResponse({ description: 'Session invalidated successfully', type: AuthOkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logout(
    @Req() req: Request & { user: JwtUser },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthOkResponseDto> {
    await this.authService.logout(req.user.userId, req.user.tokenId);
    // Path must match the path used when setting the cookie, or the browser
    // retains it and the session appears to survive logout.
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return { ok: true };
  }

  private cookieOptions() {
    return refreshCookieOptions({
      NODE_ENV: this.configService.get<string>('NODE_ENV'),
      REFRESH_COOKIE_SAME_SITE: this.configService.get<'lax' | 'none'>('REFRESH_COOKIE_SAME_SITE'),
      REFRESH_COOKIE_SECURE: this.configService.get<boolean>('REFRESH_COOKIE_SECURE'),
      JWT_REFRESH_EXPIRES_IN: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiOkResponse({
    description: 'Password reset email sent if account exists',
    type: AuthOkResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid email input' })
  async forgotPassword(@Body() dto: ForgotPasswordRequestDto): Promise<AuthOkResponseDto> {
    await this.authService.forgotPassword(dto.email);
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password using a valid token' })
  @ApiOkResponse({ description: 'Password reset successfully', type: AuthOkResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or expired token, or invalid password' })
  async resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<AuthOkResponseDto> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }
}
