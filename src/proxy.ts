import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Track page views for analytics (non-blocking)
  if (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    !pathname.startsWith("/favicon") &&
    !pathname.includes(".")
  ) {
    // Fire-and-forget analytics tracking
    const baseUrl = request.nextUrl.origin;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // We send a lightweight analytics ping
    try {
      fetch(`${baseUrl}/api/analytics/track`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          path: pathname,
          referrer: request.headers.get("referer") || "",
          userAgent: request.headers.get("user-agent") || "",
          ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
        }),
      }).catch(() => {});
    } catch {
      // Non-blocking, ignore errors
    }
  }

  // Admin route protection — check for auth cookie
  if (pathname.startsWith("/admin")) {
    const sessionToken =
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protected customer routes
  if (pathname.startsWith("/account")) {
    const sessionToken =
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
