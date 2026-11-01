import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Sends people to the right place before a page loads: logged out → /login, staff → /admin, vendors → /vendor.
 * This is only for convenience. The backend checks the login and permissions on every request.
 */

const AREA_HOME: Record<string, string> = { platform: "/admin", vendor: "/vendor" };

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const loggedIn = request.cookies.has("a360_rt");
  const home = AREA_HOME[request.cookies.get("a360_ut")?.value ?? ""] ?? "/login";

  if (pathname === "/") {
    return NextResponse.redirect(new URL(loggedIn ? home : "/login", request.url));
  }
  if (!loggedIn) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  // Each kind of account has its own area.
  if ((pathname.startsWith("/admin") && home !== "/admin") || (pathname.startsWith("/vendor") && home !== "/vendor")) {
    return NextResponse.redirect(new URL(home, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/vendor/:path*", "/account/:path*"],
};
