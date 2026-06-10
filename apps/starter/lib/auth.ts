// apps/starter/lib/auth.ts
//
// Backward-compat shim. The auth helpers now live in the package
// (`@vinext/foundation/auth` and `@vinext/foundation/auth/user-session`).
// This file re-exports the public surface and keeps a few app-specific
// helpers (Next.js route protection that calls redirect()) so the
// existing app code keeps working without changes.

import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  USER_COOKIE,
  checkPassword,
  clearSessionCookie,
  clearUserSessionCookie,
  getAuthViewer,
  getCurrentUser,
  isAuthenticated,
  setSessionCookie,
  setUserSessionCookie,
  signUserToken,
  verifyUserToken,
} from "@vinext/foundation/auth/user-session";
import type { AuthViewer } from "@vinext/foundation/auth/user-session";
import { getUserById } from "@vinext/foundation/auth/users";
import { isAdminEmail } from "@vinext/foundation/auth/internal-admin";
import { getDatabase } from "@vinext/foundation/platform";

export {
  ADMIN_COOKIE,
  USER_COOKIE,
  checkPassword,
  clearSessionCookie,
  clearUserSessionCookie,
  getAuthViewer,
  getCurrentUser,
  isAuthenticated,
  setSessionCookie,
  setUserSessionCookie,
  signUserToken,
  verifyUserToken,
};

export type { AuthViewer };

/** Pages that require any login (admin password OR OAuth). */
export async function requireAuth(returnTo = "/login"): Promise<AuthViewer> {
  const viewer = await getAuthViewer();
  if (!viewer) redirect(returnTo);
  return viewer;
}

/** Pages that require admin role. */
export async function requireAdmin(returnTo = "/login"): Promise<AuthViewer> {
  const viewer = await requireAuth(returnTo);
  if (!viewer.isAdmin) redirect("/");
  return viewer;
}

/** Pages that require user role (not just admin). */
export async function requireUser(returnTo = "/login"): Promise<AuthViewer> {
  const viewer = await requireAuth(returnTo);
  if (viewer.user) return viewer;
  redirect(returnTo);
}

/**
 * For server components that don't have a real auth context (e.g. a
 * Notion-driven blog post render), this returns `null` to match the
 * historic type signature. Callers should treat `null` as "no user".
 */
export async function getCurrentUserForRender(): Promise<AuthViewer | null> {
  return getAuthViewer();
}

/** Lookup the D1 row for the given email, or null. */
export async function getDbUserForEmail(email: string) {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email.toLowerCase())
    .first();
}

export { getUserById, isAdminEmail };
