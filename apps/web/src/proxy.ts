import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, DASHBOARD_PATH, REFRESH_COOKIE_NAME, isPublicPath } from "@/core/auth/routes";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /**
   * Presence check only — deliberately not a token validation.
   *
   * The refresh token is an opaque Redis-backed UUID, not a JWT, so middleware
   * cannot verify it without a network call on every navigation. A stale cookie
   * therefore passes this guard and fails on the first real API call with 401,
   * which then clears the session. That is the intended design: the API is the
   * sole enforcement point (FR-009) and this guard is a routing affordance.
   */
  const hasRefreshCookie = req.cookies.has(REFRESH_COOKIE_NAME);

  const isPublicRoute = isPublicPath(pathname);

  if (isPublicRoute && hasRefreshCookie) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, req.url));
  }

  if (!isPublicRoute && !hasRefreshCookie) {
    const loginUrl = new URL(LOGIN_PATH, req.url);
    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Excludes `api`, so middleware does not run on API routes — the rewrite
  // target is the backend, not this app.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
