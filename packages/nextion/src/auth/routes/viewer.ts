// auth/routes/viewer.ts
//
// GET /api/auth/viewer — returns the current viewer (admin or OAuth
// user). 401 when no valid session cookie is present.

import { NextResponse } from "next/server";
import { getAuthViewer } from "../user-session";

export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET() {
  const viewer = await getAuthViewer();
  if (!viewer) {
    return jsonResponse(
      { ok: false, reason: "unauthenticated" },
      { status: 401 }
    );
  }

  return jsonResponse({
    ok: true,
    email: viewer.email,
    role: viewer.role,
    isAdmin: viewer.isAdmin,
    isVip: viewer.isVip,
    canViewVipContent: viewer.canViewVipContent,
    user: viewer.user
      ? {
          name: viewer.user.name,
          picture: viewer.user.picture,
        }
      : null,
  });
}
