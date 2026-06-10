import { NextResponse } from "next/server";
import { signUserToken, USER_COOKIE } from "@/lib/auth";
import { userToSession, verifyEmailUser } from "@/lib/users";

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
