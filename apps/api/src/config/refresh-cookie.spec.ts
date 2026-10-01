import { describe, expect, it } from 'vitest';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  corsOrigins,
  refreshCookieOptions,
} from './refresh-cookie.js';

describe('refreshCookieOptions', () => {
  it('uses SameSite=None + Secure in production for cross-origin deploys', () => {
    const options = refreshCookieOptions({ NODE_ENV: 'production' });

    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
  });

  it('omits Secure in non-production so the cookie works over local HTTP', () => {
    // SameSite=None is rejected by browsers unless Secure is set, and Secure
    // cookies are dropped over plain HTTP. Hard-coding the production policy here
    // would silently break cookie auth on http://localhost.
    for (const nodeEnv of ['development', 'test']) {
      const options = refreshCookieOptions({ NODE_ENV: nodeEnv });

      expect(options.sameSite).toBe('lax');
      expect(options.secure).toBe(false);
    }
  });

  it('always sets httpOnly so the token is unreachable from JavaScript', () => {
    for (const nodeEnv of ['production', 'development', 'test']) {
      expect(refreshCookieOptions({ NODE_ENV: nodeEnv }).httpOnly).toBe(true);
    }
  });

  it('always scopes the cookie to the auth routes', () => {
    // Keeps a long-lived credential off every non-auth request, e.g. GET /users.
    expect(refreshCookieOptions({ NODE_ENV: 'production' }).path).toBe(REFRESH_COOKIE_PATH);
    expect(refreshCookieOptions({ NODE_ENV: 'development' }).path).toBe(REFRESH_COOKIE_PATH);
    expect(REFRESH_COOKIE_PATH).toBe('/auth');
  });

  it('honours explicit env overrides', () => {
    const options = refreshCookieOptions({
      NODE_ENV: 'development',
      REFRESH_COOKIE_SAME_SITE: 'none',
      REFRESH_COOKIE_SECURE: true,
    });

    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
  });

  it('rejects SameSite=None without Secure rather than emitting a cookie the browser drops', () => {
    expect(() =>
      refreshCookieOptions({
        NODE_ENV: 'development',
        REFRESH_COOKIE_SAME_SITE: 'none',
        REFRESH_COOKIE_SECURE: false,
      }),
    ).toThrow(/requires REFRESH_COOKIE_SECURE/);
  });

  it('derives maxAge from the refresh token lifetime', () => {
    expect(refreshCookieOptions({ JWT_REFRESH_EXPIRES_IN: '7d' }).maxAge).toBe(604_800);
    expect(refreshCookieOptions({ JWT_REFRESH_EXPIRES_IN: '30d' }).maxAge).toBe(2_592_000);
    expect(refreshCookieOptions({ JWT_REFRESH_EXPIRES_IN: '12h' }).maxAge).toBe(43_200);
    expect(refreshCookieOptions({ JWT_REFRESH_EXPIRES_IN: '30m' }).maxAge).toBe(1_800);
  });

  it('falls back to 7 days for an absent or unparseable lifetime', () => {
    expect(refreshCookieOptions({}).maxAge).toBe(604_800);
    expect(refreshCookieOptions({ JWT_REFRESH_EXPIRES_IN: 'not-a-duration' }).maxAge).toBe(604_800);
  });
});

describe('corsOrigins', () => {
  it('returns an explicit allowlist, never a wildcard', () => {
    // Browsers reject `*` on credentialed requests, which would break the
    // refresh cookie in production while every functional test still passed.
    const origins = corsOrigins({
      CORS_ORIGINS: 'https://dashboard.vercel.app, http://localhost:3000',
      FRONTEND_URL: 'http://localhost:3000',
    });

    expect(origins).toEqual(['https://dashboard.vercel.app', 'http://localhost:3000']);
    expect(origins).not.toContain('*');
  });

  it('falls back to FRONTEND_URL when unset', () => {
    expect(corsOrigins({ FRONTEND_URL: 'https://app.example.com' })).toEqual([
      'https://app.example.com',
    ]);
  });

  it('falls back to FRONTEND_URL when CORS_ORIGINS is blank', () => {
    expect(corsOrigins({ CORS_ORIGINS: '  ,  ', FRONTEND_URL: 'http://localhost:3000' })).toEqual([
      'http://localhost:3000',
    ]);
  });
});

describe('REFRESH_COOKIE_NAME', () => {
  it('is a fixed, non-underscored-prefix name', () => {
    expect(REFRESH_COOKIE_NAME).toBe('refresh_token');
  });
});
