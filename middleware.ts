import { NextRequest, NextResponse } from "next/server";

import {
  APP_SESSION_COOKIE_NAME,
  getSafeRedirectPath,
  isAuthenticatedSession,
} from "@/lib/auth";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = isAuthenticatedSession(
    request.cookies.get(APP_SESSION_COOKIE_NAME)?.value,
  );
  const isLoginPage = pathname === "/login";
  const isAuthRoute = pathname.startsWith("/api/auth/");

  if (isLoginPage) {
    if (isAuthenticated) {
      const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(next, request.url));
    }

    return NextResponse.next();
  }

  if (isAuthRoute) {
    return NextResponse.next();
  }

  if (isAuthenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    getSafeRedirectPath(`${pathname}${request.nextUrl.search}`),
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/line/webhook|api/internal/send-due|api/uploads).*)",
  ],
};
