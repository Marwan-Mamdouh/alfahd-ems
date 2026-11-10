import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Role } from '@alfahd/types';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import type { RateLimitGuard } from './guards/rate-limit.guard.js';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../config/refresh-cookie.js';
import type { LoginRequestDto, LoginResponseDto, RefreshTokenResponseDto } from './dto.js';

describe('AuthController', () => {
  describe('login — delivery channels contract (Issue #8)', () => {
    /**
     * Issue #8 mobile contract decision:
     * Contract decision: "superset, both channels always".
     *
     * The login endpoint delivers the refresh token via both the httpOnly
     * cookie (for web clients requiring XSS protection) and the JSON response
     * body (for mobile clients without a cookie jar). Mobile ignores the Set-Cookie
     * header, web ignores the body refreshToken property. Both channels are
     * always active so no ?client=mobile query parameter is required.
     */
    it('sets the httpOnly refresh cookie via res.cookie(...) and returns refreshToken in the response body', async () => {
      const mockResult: LoginResponseDto = {
        accessToken: 'access.jwt.token',
        refreshToken: 'uuid-v4-refresh-token',
        user: {
          id: 'user-id-123',
          email: 'admin@alfahd.local',
          role: Role.ADMIN,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      };

      const authService = {
        login: vi.fn().mockResolvedValue(mockResult),
      } as unknown as AuthService;

      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'NODE_ENV') return 'test';
          if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
          return undefined;
        }),
      } as unknown as ConfigService;

      const rateLimitGuard = {
        recordFailure: vi.fn().mockResolvedValue(undefined),
      } as unknown as RateLimitGuard;

      const controller = new AuthController(authService, configService, rateLimitGuard);

      const req = {} as Request;
      const res = {
        cookie: vi.fn(),
      } as unknown as Response;

      const dto: LoginRequestDto = {
        email: 'admin@alfahd.local',
        password: 'correct-password',
      };

      const response = await controller.login(dto, req, res);

      // Verify delivery channel 1: httpOnly cookie via res.cookie
      expect(res.cookie).toHaveBeenCalledTimes(1);
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'uuid-v4-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );

      // Verify delivery channel 2: refreshToken present in body for mobile clients
      expect(response).toBeDefined();
      expect(response.refreshToken).toBe('uuid-v4-refresh-token');
      expect(response.accessToken).toBe('access.jwt.token');
      expect(response.user.email).toBe('admin@alfahd.local');
    });
  });

  describe('refresh — rotation and cookie lifecycle', () => {
    it('cookie-first: rotates refresh cookie and returns service result', async () => {
      const mockResult: RefreshTokenResponseDto = {
        accessToken: 'new.jwt',
        refreshToken: 'new-token-id',
      };

      const authService = {
        refresh: vi.fn().mockResolvedValue(mockResult),
      } as unknown as AuthService;

      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'NODE_ENV') return 'test';
          if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
          return undefined;
        }),
      } as unknown as ConfigService;

      const rateLimitGuard = {} as RateLimitGuard;

      const controller = new AuthController(authService, configService, rateLimitGuard);

      const req = {
        cookies: { [REFRESH_COOKIE_NAME]: 'old-token' },
        ip: '127.0.0.1',
      } as unknown as Request;
      const res = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      } as unknown as Response;

      const result = await controller.refresh({}, req, res);

      expect(authService.refresh).toHaveBeenCalledWith('old-token', '127.0.0.1');
      expect(res.cookie).toHaveBeenCalledTimes(1);
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'new-token-id',
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
      expect(result).toEqual(mockResult);
    });

    it('failure: clears rejected cookie with REFRESH_COOKIE_PATH on UnauthorizedException and propagates error', async () => {
      const authService = {
        refresh: vi.fn().mockRejectedValue(new UnauthorizedException('Invalid refresh token')),
      } as unknown as AuthService;

      const configService = {
        get: vi.fn(),
      } as unknown as ConfigService;

      const rateLimitGuard = {} as RateLimitGuard;

      const controller = new AuthController(authService, configService, rateLimitGuard);

      const req = {
        cookies: { [REFRESH_COOKIE_NAME]: 'invalid-token' },
      } as unknown as Request;
      const res = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      } as unknown as Response;

      await expect(controller.refresh({}, req, res)).rejects.toThrow(UnauthorizedException);

      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, {
        path: REFRESH_COOKIE_PATH,
      });
    });
  });
});
