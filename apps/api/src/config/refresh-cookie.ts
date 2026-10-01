import type { CookieOptions } from 'express';
import type { EnvConfig } from './env.validation.js';

/**
 * Name of the refresh-token cookie.
 *
 * The value is an opaque session token id (see AuthService.refresh) — never a JWT.
 */
export const REFRESH_COOKIE_NAME = 'refresh_token';

/**
 * Scopes the cookie to the auth routes so it is never attached to `GET /users`
 * or any other request. Minimises exposure of a long-lived credential.
 *
 * NOTE: `POST /auth/logout` must clear the cookie with this same path, otherwise
 * the browser keeps it and the session appears to survive logout.
 */
export const REFRESH_COOKIE_PATH = '/auth';

export type CookieSameSite = 'lax' | 'none';

export interface RefreshCookieEnv {
  NODE_ENV?: string;
  REFRESH_COOKIE_SAME_SITE?: CookieSameSite;
  REFRESH_COOKIE_SECURE?: boolean;
  JWT_REFRESH_EXPIRES_IN?: string;
}

/**
 * Build the cookie attributes for the refresh token.
 *
 * Kept pure and separate from the Nest bootstrap so the policy is unit-testable
 * without standing up the app.
 *
 * Why this is environment-driven rather than constant: the API (Railway) and the
 * dashboard (Vercel) are different origins, so production requires
 * `SameSite=None` — but browsers reject `SameSite=None` unless `Secure` is also
 * set, and `Secure` cookies are dropped over plain HTTP. A single hard-coded
 * `None; Secure` policy therefore works in production and fails on
 * `http://localhost`, where the symptom is "refresh always 401s" rather than an
 * obvious config error.
 */
export function refreshCookieOptions(env: RefreshCookieEnv): CookieOptions {
  const isProduction = env.NODE_ENV === 'production';

  const secure = env.REFRESH_COOKIE_SECURE ?? isProduction;
  const sameSite: CookieSameSite = env.REFRESH_COOKIE_SAME_SITE ?? (isProduction ? 'none' : 'lax');

  // SameSite=None is invalid without Secure; fail fast rather than emit a cookie
  // the browser will silently drop.
  if (sameSite === 'none' && !secure) {
    throw new Error(
      'REFRESH_COOKIE_SAME_SITE=none requires REFRESH_COOKIE_SECURE=true — browsers reject SameSite=None without Secure',
    );
  }

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshMaxAgeSeconds(env.JWT_REFRESH_EXPIRES_IN),
  };
}

/**
 * Cookie `maxAge` in seconds, derived from the refresh-token lifetime so the
 * browser copy expires with the Redis session rather than outliving it.
 */
function refreshMaxAgeSeconds(refreshExpiresIn: string | undefined): number {
  if (!refreshExpiresIn) return 7 * 24 * 60 * 60;
  const match = /^(\d+)\s*([smhd])$/.exec(refreshExpiresIn.trim());
  if (!match) return 7 * 24 * 60 * 60;
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return value * multiplier;
}

/**
 * Origins allowed to make credentialed requests.
 *
 * Never returns `'*'`: with `credentials: true` browsers reject a wildcard
 * origin, so the response would carry no `Access-Control-Allow-Origin` and the
 * browser would block the request. Falls back to FRONTEND_URL so a default
 * single-origin setup works with no extra configuration.
 */
export function corsOrigins(env: Pick<EnvConfig, 'CORS_ORIGINS' | 'FRONTEND_URL'>): string[] {
  const configured = env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (configured && configured.length > 0) {
    return configured;
  }

  return [env.FRONTEND_URL];
}
