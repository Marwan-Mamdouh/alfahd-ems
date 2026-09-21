import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, DASHBOARD_PATH, SESSION_COOKIE_NAME } from "@/core/auth/routes";

const PUBLIC_ROUTES = [LOGIN_PATH, "/forgot-password", "/reset-password"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isPublicRoute && hasSession) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, req.url));
  }

  if (!isPublicRoute && !hasSession) {
    const loginUrl = new URL(LOGIN_PATH, req.url);
    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
