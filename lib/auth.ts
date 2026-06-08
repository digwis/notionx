// 简易认证：HMAC 签名的 session cookie。
// 生产前请把 ADMIN_PASSWORD 改强，并通过 `wrangler secret put ADMIN_PASSWORD` 注入。
// dev 下用 .dev.vars 里的值；本地没有 .dev.vars 时降级到 process.env。

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { getUserById, normalizeUserRole, type UserRole } from "./users";
import type { SessionUser } from "./session";

export type { SessionUser } from "./session";

const COOKIE_NAME = "vinext_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

function getAdminPassword(): string {
  // 优先从 Cloudflare env 取，dev 下 .dev.vars 自动注入；fallback 到 Node 的 process.env
  const fromWorker = (env as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD;
  if (fromWorker) return fromWorker;
  return process.env.ADMIN_PASSWORD ?? "vinext-admin-2026";
}

// HMAC-SHA256 via Web Crypto（Cloudflare / Vite dev 都可用）
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

async function signToken(): Promise<string> {
  const password = getAdminPassword();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `ok.${exp}`;
  const sig = await hmac(password, payload);
  return `${payload}.${sig}`;
}

async function verifyToken(token: string | undefined): Promise<boolean> {
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
  const token = await signToken();
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/** 在 Server Action / Server Component 中使用。失败则跳转到 /login。 */
export async function requireAuth(): Promise<{ email: string }> {
  const jar = await cookies();
  // 1) admin 密码登录
  if (await verifyToken(jar.get(COOKIE_NAME)?.value)) {
    const fromWorker = (env as { ADMIN_EMAIL?: string }).ADMIN_EMAIL;
    const email = fromWorker || "zhaofilms@gmail.com";
    return { email };
  }
  // 2) OAuth 用户
  const user = await verifyUserToken(jar.get(USER_COOKIE)?.value);
  if (user) return { email: user.email };
  redirect("/login");
}

export type AuthViewer = {
  email: string;
  user: SessionUser | null;
  role: UserRole;
  isAdmin: boolean;
  isVip: boolean;
  canViewVipContent: boolean;
};

function getAdminEmail(): string {
  const fromWorker = (env as { ADMIN_EMAIL?: string }).ADMIN_EMAIL;
  return (fromWorker || "zhaofilms@gmail.com").toLowerCase();
}

// ====== OAuth (Google) session ======
// 与 admin 密码的 session 平行存在。
// 同样的 HMAC-SHA256 签名机制（用 ADMIN_PASSWORD 当 HMAC 密钥，方便 secret 复用）。

export const USER_COOKIE = "vinext_user_session";

async function signPayload(payload: string): Promise<string> {
  const password = getAdminPassword();
  return hmac(password, payload);
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
  jar.set(USER_COOKIE, token, {
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

// 标准 UTF-8 ↔ base64 转换（避免 unescape/escape 的废弃 API）
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

/** 当前 OAuth 用户（如果登录了），admin 密码登录时返 null */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(USER_COOKIE)?.value;
  return verifyUserToken(token);
}

export async function getAuthViewer(): Promise<AuthViewer | null> {
  const jar = await cookies();

  if (await verifyToken(jar.get(COOKIE_NAME)?.value)) {
    return {
      email: getAdminEmail(),
      user: null,
      role: "admin",
      isAdmin: true,
      isVip: true,
      canViewVipContent: true,
    };
  }

  const user = await verifyUserToken(jar.get(USER_COOKIE)?.value);
  if (!user) return null;

  const dbUser = await getUserById(user.uid);
  if (!dbUser) return null;
  const role = normalizeUserRole(dbUser.role);
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

/** 清除 OAuth session */
export async function clearUserSessionCookie() {
  const jar = await cookies();
  jar.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * 扩展版 isAuthenticated：admin 密码登录或 OAuth 登录都算已认证
 */
export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  if (await verifyToken(jar.get(COOKIE_NAME)?.value)) return true;
  if (await verifyUserToken(jar.get(USER_COOKIE)?.value)) return true;
  return false;
}
