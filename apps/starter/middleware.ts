import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultLocale, isAppLocale } from "@/lib/i18n/config";

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
