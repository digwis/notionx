// GET /api/auth/google/callback - Google OAuth 回调
// 1. 验证 state cookie
// 2. 用 code 换 access_token（从 app_settings 取 client_id/secret）
// 3. 用 access_token 拉 userinfo
// 4. 写 D1 users 表（含 role）
// 5. 设 vinext_user_session HMAC cookie
// 6. 302 → /admin

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGoogleOAuthConfig } from "@/lib/settings";
import { upsertGoogleUser, userToSession } from "@/lib/users";
import { signUserToken, USER_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "vinext_oauth_state";

export async function GET(request: Request) {
  const config = await getGoogleOAuthConfig();
  if (!config) {
    return new NextResponse("Google OAuth not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new NextResponse(`Google OAuth error: ${error}`, { status: 400 });
  }
  if (!code || !state) {
    return new NextResponse("Missing code or state", { status: 400 });
  }

  // 1. 验证 state
  const jar = await cookies();
  const savedState = jar.get(STATE_COOKIE)?.value;
  if (!savedState || savedState !== state) {
    return new NextResponse("Invalid state (CSRF protection)", { status: 400 });
  }

  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    // 2. code → access_token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.status} ${t}`);
    }
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      id_token: string;
    };

    // 3. access_token → userinfo
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error("Failed to fetch user info");
    const profile = (await userRes.json()) as {
      id: string;
      email: string;
      verified_email: boolean;
      name: string;
      picture: string;
    };

    if (!profile.verified_email) {
      return new NextResponse("Google email not verified", { status: 403 });
    }

    // 4. 写 D1
    const user = await upsertGoogleUser({
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      googleSub: profile.id,
    });

    // 5. 发 session cookie
    const token = await signUserToken(userToSession(user));

    // 6. 302 → /admin
    const res = NextResponse.redirect(`${origin}/admin`);
    res.cookies.set(USER_COOKIE, token, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`OAuth callback error: ${msg}`, { status: 500 });
  }
}
