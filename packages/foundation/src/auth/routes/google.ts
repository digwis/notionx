// auth/routes/google.ts
//
// GET /api/auth/google — kick off the Google OAuth flow:
//   1. Generate a random `state` (CSRF protection).
//   2. Save it to a short-lived cookie.
//   3. 302 redirect to Google's consent screen.
//
// The Google OAuth client id/secret are read from the admin-configured
// `app_settings` row, not from environment variables, so admins can
// enable/disable the flow at runtime.

import { NextResponse } from "next/server";
import { getGoogleOAuthConfig } from "../../internal/admin/settings";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "vinext_oauth_state";

export async function GET(request: Request) {
  const config = await getGoogleOAuthConfig();
  if (!config) {
    return new NextResponse(
      "Google OAuth not configured. Enable it in admin /admin/settings.",
      { status: 503 }
    );
  }

  const state = [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", config.clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");

  const res = NextResponse.redirect(googleAuthUrl.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
