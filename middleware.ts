import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes — no auth required
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/activate-account",
];

// Routes only customers can access
const CUSTOMER_ONLY_PATHS = ["/customer/portal"];

// Routes customers cannot access
const INTERNAL_ONLY_PATHS = ["/dashboard", "/customer-master", "/subscription", "/marketing-log", "/visitor-management", "/follow-up", "/audit-logs", "/user-master", "/settings"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // Allow root redirect
  if (pathname === "/") {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  // Not authenticated → redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode token (edge-compatible — no full verify needed, just role extraction)
  let payload: { id: string; email: string; role: string } | null = null;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      payload = JSON.parse(atob(parts[1]));
    }
  } catch (err) {
    console.error("Failed to parse token in middleware", err);
  }

  if (!payload || !payload.role) {
    // Invalid token structure — redirect to login
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("token");
    return response;
  }

  const role = payload.role;

  // Customer trying to access internal routes
  if (role === "Customer" && INTERNAL_ONLY_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/customer/portal", request.url));
  }

  // Internal user trying to access customer portal
  if (role !== "Customer" && CUSTOMER_ONLY_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)" ,
  ],
};
