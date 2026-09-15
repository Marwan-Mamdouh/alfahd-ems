
// import { NextResponse, type NextRequest } from "next/server";

// const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password"];

// export function middleware(req: NextRequest) {
//   const { pathname } = req.nextUrl;
//   const hasSession = req.cookies.has("fahd-session");

//   const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

//   if (isPublicRoute && hasSession) {
//     return NextResponse.redirect(new URL("/dashboard", req.url));
//   }

//   if (!isPublicRoute && !hasSession) {
//     const loginUrl = new URL("/login", req.url);
//     loginUrl.searchParams.set("redirect", pathname);
//     return NextResponse.redirect(loginUrl);
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: [
//     "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
//   ],
// };
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};