// auth/routes/verify-email.ts
//
// GET /api/auth/verify-email?token=… — completes the email-address
// verification step of the email/password registration flow. On
// success the user is auto-logged in (HMAC cookie) and redirected
// to /admin.

import { NextResponse } from "next/server";
import { signUserToken, USER_COOKIE } from "../user-session";
import { userToSession, verifyEmailUser } from "../users";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?verifyError=invalid", url));
  }

  const user = await verifyEmailUser(token);
  if (!user) {
    return NextResponse.redirect(new URL("/login?verifyError=invalid", url));
  }

  const sessionToken = await signUserToken(userToSession(user));

  const res = NextResponse.redirect(new URL("/admin?verified=1", url));
  res.cookies.set(USER_COOKIE, sessionToken, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
