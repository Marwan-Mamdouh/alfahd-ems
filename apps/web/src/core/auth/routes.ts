/** Client-side login page route (not the API endpoint — see ENDPOINTS.auth.login) */
export const LOGIN_PATH = "/auth/login" as const;

/** Client-side dashboard root route */
export const DASHBOARD_PATH = "/dashboard" as const;

/**
 * Client-side password-recovery routes.
 *
 * These must match the directory paths under `src/app/auth/`, because the App
 * Router derives the URL from the directory — `app/auth/forgot-password` yields
 * `/auth/forgot-password`. They are the paths `proxy.ts` treats as public and the
 * paths the backend embeds in reset emails.
 */
export const FORGOT_PASSWORD_PATH = "/auth/forgot-password" as const;

export const RESET_PASSWORD_PATH = "/auth/reset-password" as const;

/**
 * Name of the refresh-token cookie set by the API and read by the proxy guard.
 *
 * The source of truth is `REFRESH_COOKIE_NAME` in
 * `apps/api/src/config/refresh-cookie.ts`. The value is `refresh_token`. It must
 * not be changed here: a wrong name typechecks and lints, then silently never
 * matches, so the guard redirects every user to login with no error anywhere.
 *
 * This replaces the old `SESSION_COOKIE_NAME` ("fahd-session") flag cookie, which
 * was writable from JavaScript and therefore was not an authentication control.
 */
export const REFRESH_COOKIE_NAME = "refresh_token" as const;

/** Routes reachable without a session. The single list used by the proxy guard and the client. */
export const PUBLIC_PATHS = [LOGIN_PATH, FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH] as const;

/** True for a public route or any sub-path of one (`/auth/login`, `/auth/login/x`). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** Login URL that sends the user back to `pathname` after authenticating (FR-008). */
export function loginUrlWithRedirect(pathname: string): string {
  return `${LOGIN_PATH}?${new URLSearchParams({ redirect: pathname }).toString()}`;
}
