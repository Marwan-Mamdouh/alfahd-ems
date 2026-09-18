import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/auth/login";
const DASHBOARD_PATH = "/dashboard";

const PUBLIC_ROUTES = [LOGIN_PATH];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("fahd-session");

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
