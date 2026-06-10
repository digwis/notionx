// auth/users.ts - user persistence for Google OAuth and email/password auth
//
// Internal-only module of the auth feature. The exported functions back
// the email/password registration flow, Google OAuth upserts, the admin
// user-management API, and the bootstrap that creates the first admin
// account. Table names and database binding come from the platform
// runtime (`getDatabase`) which is configured by the consuming app.

import { hashPassword, verifyPassword } from "./passwords";
import { isAdminEmail } from "../internal/admin/admin";
import { getAppSettings } from "../internal/admin/settings";
import { getDatabase } from "../platform/current";
import type { SessionUser } from "./session";

export type UserRole = "user" | "vip" | "admin";
export type UserListItem = User & { post_count: number };

export type User = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  google_sub: string | null;
  password_hash: string | null;
  email_verified: number;
  email_verify_token: string | null;
  email_verify_expires_at: string | null;
  password_reset_token: string | null;
  password_reset_expires_at: string | null;
  session_rev: number;
  role: UserRole | null;
  created_at: string;
  last_seen_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function defaultRoleFor(email: string): Promise<"user" | "admin"> {
  return (await isAdminEmail(email)) ? "admin" : "user";
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  if (role === "admin" || role === "vip") return role;
  return "user";
}

function createRandomToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function userToSession(user: User): SessionUser {
  return {
    uid: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    rev: user.session_rev ?? 0,
  };
}

export async function upsertGoogleUser(input: {
  email: string;
  name: string;
  picture: string;
  googleSub: string;
}): Promise<User> {
  const db = getDatabase();
  const email = normalizeEmail(input.email);

  const existing = await db.prepare(
    `SELECT * FROM users WHERE google_sub = ? OR email = ? LIMIT 1`
  )
    .bind(input.googleSub, email)
    .first<User>();

  if (existing) {
    await db.prepare(
      `UPDATE users
       SET email = ?, name = ?, picture = ?, google_sub = ?, email_verified = 1,
           email_verify_token = NULL, email_verify_expires_at = NULL,
           last_seen_at = datetime('now')
       WHERE id = ?`
    )
      .bind(email, input.name, input.picture, input.googleSub, existing.id)
      .run();
  } else {
    const role = await defaultRoleFor(email);
    await db.prepare(
      `INSERT INTO users (
        email, name, picture, google_sub, email_verified, role, last_seen_at
      ) VALUES (?, ?, ?, ?, 1, ?, datetime('now'))`
    )
      .bind(email, input.name, input.picture, input.googleSub, role)
      .run();
  }

  if (await isAdminEmail(email)) {
    await db.prepare(
      `UPDATE users SET role = 'admin' WHERE email = ?`
    ).bind(email).run();
  }

  const user = await getUserByEmail(email);
  if (!user) throw new Error("User upsert failed");
  return user;
}

export async function createEmailUser(input: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; user: User; verifyToken: string }
  | { ok: false; reason: "exists" }
> {
  const email = normalizeEmail(input.email);
  const existing = await getUserByEmail(email);
  if (existing) {
    return { ok: false, reason: "exists" };
  }

  const passwordHash = await hashPassword(input.password);
  const verifyToken = createRandomToken();
  const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const role = await defaultRoleFor(email);
  const db = getDatabase();
  await db.prepare(
    `INSERT INTO users (
      email, password_hash, email_verified, email_verify_token,
      email_verify_expires_at, role, last_seen_at
    ) VALUES (?, ?, 0, ?, ?, ?, datetime('now'))`
  )
    .bind(email, passwordHash, verifyToken, verifyExpiresAt, role)
    .run();

  if (role === "admin") {
    await db.prepare(
      `UPDATE users SET role = 'admin' WHERE email = ?`
    ).bind(email).run();
  }

  const user = await getUserByEmail(email);
  if (!user) throw new Error("User creation failed");
  return { ok: true, user, verifyToken };
}

export async function verifyEmailUser(token: string): Promise<User | null> {
  const user = await getDatabase().prepare(
    `SELECT * FROM users WHERE email_verify_token = ?`
  )
    .bind(token)
    .first<User>();

  if (!user || !user.email_verify_expires_at) return null;
  if (new Date(user.email_verify_expires_at).getTime() < Date.now()) {
    return null;
  }

  await getDatabase().prepare(
    `UPDATE users
     SET email_verified = 1,
         email_verify_token = NULL,
         email_verify_expires_at = NULL,
         last_seen_at = datetime('now')
     WHERE id = ?`
  )
    .bind(user.id)
    .run();

  return getUserByEmail(user.email);
}

export async function issueVerificationToken(
  email: string
): Promise<
  | { ok: true; token: string; user: User }
  | { ok: false; reason: "not_found" | "already_verified" | "no_password" }
> {
  const user = await getUserByEmail(email);
  if (!user) return { ok: false, reason: "not_found" };
  if (!user.password_hash) return { ok: false, reason: "no_password" };
  if (user.email_verified) return { ok: false, reason: "already_verified" };

  const verifyToken = createRandomToken();
  const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  await getDatabase().prepare(
    `UPDATE users
     SET email_verify_token = ?, email_verify_expires_at = ?
     WHERE id = ?`
  )
    .bind(verifyToken, verifyExpiresAt, user.id)
    .run();

  const updated = await getUserByEmail(email);
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, token: verifyToken, user: updated };
}

export async function issuePasswordResetToken(
  email: string
): Promise<
  | { ok: true; token: string; user: User }
  | { ok: false; reason: "not_found" | "no_password" | "unverified" }
> {
  const user = await getUserByEmail(email);
  if (!user || !user.password_hash) {
    return { ok: false, reason: "not_found" };
  }
  if (!user.email_verified) {
    return { ok: false, reason: "unverified" };
  }

  const resetToken = createRandomToken();
  const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

  await getDatabase().prepare(
    `UPDATE users
     SET password_reset_token = ?, password_reset_expires_at = ?
     WHERE id = ?`
  )
    .bind(resetToken, resetExpiresAt, user.id)
    .run();

  const updated = await getUserByEmail(email);
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, token: resetToken, user: updated };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" }
> {
  const user = await getDatabase().prepare(
    `SELECT * FROM users WHERE password_reset_token = ?`
  )
    .bind(input.token)
    .first<User>();

  if (!user || !user.password_reset_expires_at) {
    return { ok: false, reason: "invalid" };
  }
  if (new Date(user.password_reset_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "invalid" };
  }

  const passwordHash = await hashPassword(input.password);
  await getDatabase().prepare(
    `UPDATE users
     SET password_hash = ?,
         password_reset_token = NULL,
         password_reset_expires_at = NULL,
         session_rev = session_rev + 1,
         last_seen_at = datetime('now')
     WHERE id = ?`
  )
    .bind(passwordHash, user.id)
    .run();

  const updated = await getUserById(user.id);
  if (!updated) return { ok: false, reason: "invalid" };
  return { ok: true, user: updated };
}

export async function changeUserPassword(input: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}): Promise<
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "no_password" }
> {
  const user = await getUserById(input.userId);
  if (!user || !user.password_hash) {
    return { ok: false, reason: "no_password" };
  }

  const matches = await verifyPassword(
    input.currentPassword,
    user.password_hash
  );
  if (!matches) {
    return { ok: false, reason: "invalid" };
  }

  const passwordHash = await hashPassword(input.newPassword);
  await getDatabase().prepare(
    `UPDATE users
     SET password_hash = ?,
         session_rev = session_rev + 1,
         last_seen_at = datetime('now')
     WHERE id = ?`
  )
    .bind(passwordHash, user.id)
    .run();

  const updated = await getUserById(user.id);
  if (!updated) return { ok: false, reason: "invalid" };
  return { ok: true, user: updated };
}

export async function authenticateEmailUser(input: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "unverified" }
> {
  const email = normalizeEmail(input.email);
  const user = await getUserByEmail(email);
  if (!user || !user.password_hash) {
    return { ok: false, reason: "invalid" };
  }

  const matches = await verifyPassword(input.password, user.password_hash);
  if (!matches) {
    return { ok: false, reason: "invalid" };
  }
  if (!user.email_verified) {
    return { ok: false, reason: "unverified" };
  }

  await getDatabase().prepare(
    `UPDATE users SET last_seen_at = datetime('now') WHERE id = ?`
  )
    .bind(user.id)
    .run();

  return { ok: true, user: { ...user, email } };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return await getDatabase().prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(normalizeEmail(email))
    .first<User>();
}

export async function getUserById(id: number): Promise<User | null> {
  return await getDatabase().prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(id)
    .first<User>();
}

export async function listUsers(limit = 100): Promise<User[]> {
  const { results } = await getDatabase().prepare(
    `SELECT * FROM users ORDER BY created_at DESC LIMIT ?`
  )
    .bind(limit)
    .all<User>();
  return results || [];
}

export async function listUsersWithPostCounts(
  limit = 100
): Promise<UserListItem[]> {
  const { results } = await getDatabase().prepare(
    `SELECT u.*,
            (SELECT COUNT(*) FROM posts p WHERE p.owner_email = u.email) AS post_count
       FROM users u
      ORDER BY u.created_at DESC
      LIMIT ?`
  )
    .bind(limit)
    .all<UserListItem>();
  return results || [];
}

/** 递增 session_rev，使该用户所有已签发 cookie 立即失效。 */
export async function revokeUserSessions(userId: number): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  await getDatabase().prepare(
    `UPDATE users SET session_rev = session_rev + 1 WHERE id = ?`
  )
    .bind(userId)
    .run();
  return true;
}

export async function setUserRole(
  userId: number,
  role: Exclude<UserRole, "admin">
): Promise<
  | { ok: true; user: User }
  | { ok: false; reason: "not_found" | "is_admin" }
> {
  const user = await getUserById(userId);
  if (!user) return { ok: false, reason: "not_found" };
  if (await isAdminEmail(user.email)) {
    return { ok: false, reason: "is_admin" };
  }

  await getDatabase().prepare(
    `UPDATE users
        SET role = ?,
            last_seen_at = datetime('now')
      WHERE id = ?`
  )
    .bind(role, userId)
    .run();

  const updated = await getUserById(userId);
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, user: updated };
}

export async function deleteUserAccount(userId: number): Promise<
  | { ok: true; email: string }
  | { ok: false; reason: "not_found" | "is_admin" }
> {
  const user = await getUserById(userId);
  if (!user) return { ok: false, reason: "not_found" };
  if (await isAdminEmail(user.email)) {
    return { ok: false, reason: "is_admin" };
  }

  const settings = await getAppSettings();
  const adminEmail = settings.admin_email;

  const db = getDatabase();
  await db.batch([
    db.prepare(
      `UPDATE posts SET owner_email = ? WHERE owner_email = ?`
    ).bind(adminEmail, user.email),
    db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId),
  ]);

  return { ok: true, email: user.email };
}
