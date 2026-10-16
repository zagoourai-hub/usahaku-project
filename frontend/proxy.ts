import { NextResponse, type NextRequest } from "next/server";

// Better Auth session cookie (cookiePrefix "usahaku" in backend/src/auth/auth.config.ts);
// production adds the "__Secure-" prefix.
const AUTH_COOKIES = ["usahaku.session_token", "__Secure-usahaku.session_token"];

// Optimistic check only (cookie presence). The API still verifies the session on
// every request; a stale cookie is cleared by the 401 handler in providers.tsx.
export function proxy(request: NextRequest) {
  const hasSession = AUTH_COOKIES.some((name) => request.cookies.has(name));
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
