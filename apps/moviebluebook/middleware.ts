import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultLocale, isAppLocale } from "@/lib/i18n/config";

// Project-specific Next.js middleware. The structural session/viewer
// logic lives in `@vinext/foundation/middleware` (`foundationMiddleware`
// and `createFoundationMiddleware`). When Phase 5.4+ lands the
// auth-aware cookie read here, this file can shrink to just the
// movies redirect and the `x-app-locale` header.
//
// The Next.js matcher and the i18n locale handling stay here because
// they are project-specific (vinext's router does not need to know
// about the `/movies` redirect or the `x-app-locale` header).

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/movies" || pathname.startsWith("/movies/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  const localeMatch = pathname.match(/^\/([^/]+)(\/.*)?$/);
  const locale = localeMatch?.[1] ?? "";
  if (locale && pathname.includes("/movies") && isAppLocale(locale)) {
    const response = NextResponse.next();
    response.headers.set("x-app-locale", locale);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/movies/:path*", "/:locale/movies/:path*"],
};
