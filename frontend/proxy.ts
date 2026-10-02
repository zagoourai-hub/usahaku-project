import { NextResponse, type NextRequest } from "next/server";

// Must match AUTH_COOKIE in backend/src/auth/auth.guard.ts.
const AUTH_COOKIE = "access_token";

// Optimistic check only (cookie presence). The API still verifies the JWT on
// every request; a stale cookie is cleared by the 401 handler in providers.tsx.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(AUTH_COOKIE);
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage && hasSession) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (!isAuthPage && !hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/onboarding",
    "/dashboard/:path*",
    "/ingredients/:path*",
    "/recipes/:path*",
    "/transactions/:path*",
    "/reports/:path*",
    "/receipts/:path*",
  ],
};
