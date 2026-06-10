// auth/user-session.ts - OAuth (Google) session cookie helpers.
//
// The session is an HMAC-SHA256-signed base64-encoded JSON payload
// containing the user identity and an expiry. The HMAC key is the
// `ADMIN_PASSWORD` secret so projects can reuse one Cloudflare secret
// for both admin-password and OAuth cookies. The `session_rev` field
// is incremented to invalidate every cookie for a user at once
// (used on password reset, account delete, etc.).

import { cookies } from "next/headers";
import { getUserById } from "./users";
import { getDatabase } from "../platform/current";
import type { SessionUser } from "./session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const USER_COOKIE_NAME = "vinext_user_session";
const ADMIN_COOKIE_NAME = "vinext_admin_session";

/** Cookie name holding the OAuth (Google) user session. */
export const USER_COOKIE = USER_COOKIE_NAME;

/** Cookie name holding the admin-password session. */
export const ADMIN_COOKIE = ADMIN_COOKIE_NAME;

interface WorkerEnvLike {
  ADMIN_PASSWORD?: string;
}

function getAdminPassword(): string {
  // Prefer the platform env (Cloudflare / vite dev with .dev.vars). Falls
  // back to process.env for environments where neither is configured.
  // The fallback value is intentionally weak; production deployments
  // must set ADMIN_PASSWORD via `wrangler secret put`.
  let fromWorker: string | undefined;
  try {
    // The optional import keeps this module usable in unit tests that
    // do not have the `cloudflare:workers` virtual module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("cloudflare:workers") as { env?: WorkerEnvLike };
    fromWorker = mod.env?.ADMIN_PASSWORD;
  } catch {
    fromWorker = undefined;
  }
  if (fromWorker) return fromWorker;
  return process.env.ADMIN_PASSWORD ?? "vinext-admin-2026";
}

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i]! ^ bBytes[i]!;
  }
  return diff === 0;
}

async function signPayload(payload: string): Promise<string> {
  return hmac(getAdminPassword(), payload);
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 给 OAuth 用户发 token：HMAC 签名 + base64-encoded JSON payload */
export async function signUserToken(user: SessionUser): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = { ...user, exp };
  const json = JSON.stringify(payload);
  const b64 = utf8ToBase64(json);
  const sig = await signPayload(b64);
  return `${b64}.${sig}`;
}

export async function setUserSessionCookie(user: SessionUser) {
  const token = await signUserToken(user);
  const jar = await cookies();
  jar.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** 校验用户 session token：签名、过期、session_rev 是否与数据库一致 */
export async function verifyUserToken(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = await signPayload(b64!);
  if (!(await constantTimeEqual(sig!, expected))) return null;
  try {
    const json = base64ToUtf8(b64!);
    const payload = JSON.parse(json) as SessionUser & { exp: number };
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    const dbUser = await getUserById(payload.uid);
    if (!dbUser) return null;
    if (dbUser.email !== payload.email) return null;
    const tokenRev = payload.rev ?? 0;
    const dbRev = dbUser.session_rev ?? 0;
    if (tokenRev !== dbRev) return null;

    return {
      uid: payload.uid,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      rev: dbRev,
    };
  } catch {
    return null;
  }
}

/** 当前 OAuth 用户（如果登录了），admin 密码登录时返 null */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(USER_COOKIE_NAME)?.value;
  return verifyUserToken(token);
}

export async function clearUserSessionCookie() {
  const jar = await cookies();
  jar.set(USER_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

// ====== Admin-password session ======

async function signAdminToken(): Promise<string> {
  const password = getAdminPassword();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `ok.${exp}`;
  const sig = await hmac(password, payload);
  return `${payload}.${sig}`;
}

async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [flag, expStr, sig] = parts;
  if (flag !== "ok") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const password = getAdminPassword();
  const expected = await hmac(password, `${flag}.${exp}`);
  return constantTimeEqual(sig!, expected);
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = getAdminPassword();
  return constantTimeEqual(input, expected);
}

export async function setSessionCookie() {
  const token = await signAdminToken();
  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

function getAdminEmailFromEnv(): string {
  let fromWorker: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("cloudflare:workers") as { env?: { ADMIN_EMAIL?: string } };
    fromWorker = mod.env?.ADMIN_EMAIL;
  } catch {
    fromWorker = undefined;
  }
  return (fromWorker || "zhaofilms@gmail.com").toLowerCase();
}

export type AuthViewer = {
  email: string;
  user: SessionUser | null;
  role: "user" | "vip" | "admin";
  isAdmin: boolean;
  isVip: boolean;
  canViewVipContent: boolean;
};

/**
 * Combined viewer: returns an `AuthViewer` for the current request
 * regardless of which login method (admin password vs OAuth) the
 * user used. `null` means the request is unauthenticated.
 */
export async function getAuthViewer(): Promise<AuthViewer | null> {
  const jar = await cookies();

  if (await verifyAdminToken(jar.get(ADMIN_COOKIE_NAME)?.value)) {
    return {
      email: getAdminEmailFromEnv(),
      user: null,
      role: "admin",
      isAdmin: true,
      isVip: true,
      canViewVipContent: true,
    };
  }

  const user = await verifyUserToken(jar.get(USER_COOKIE_NAME)?.value);
  if (!user) return null;

  const dbUser = await getUserById(user.uid);
  if (!dbUser) return null;
  const role: "user" | "vip" | "admin" =
    dbUser.role === "admin" || dbUser.role === "vip" ? dbUser.role : "user";
  const isAdmin = role === "admin";
  const isVip = role === "vip" || isAdmin;

  return {
    email: user.email,
    user,
    role,
    isAdmin,
    isVip,
    canViewVipContent: isVip,
  };
}

/**
 * Extended isAuthenticated: admin password login or OAuth login both
 * count as authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  if (await verifyAdminToken(jar.get(ADMIN_COOKIE_NAME)?.value)) return true;
  if (await verifyUserToken(jar.get(USER_COOKIE_NAME)?.value)) return true;
  return false;
}

// Re-export the database helper to keep callers from having to reach
// into the platform layer just to update session_rev after a reset.
export { getDatabase };
