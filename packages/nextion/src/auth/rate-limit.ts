// SQL-backed rate limiting for auth endpoints (per email + per IP).

import { getDatabase } from "../platform/current";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_EMAIL_ATTEMPTS = 5;
const MAX_IP_ATTEMPTS = 30;

export type AuthRateLimitKind = "login" | "forgot" | "resend" | "register";

type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; scope: "email" | "ip" };

type RateLimitBucket = "email" | "ip";

function scopeKey(
  kind: AuthRateLimitKind,
  bucket: RateLimitBucket,
  identifier: string
): string {
  const normalized =
    bucket === "email"
      ? identifier.trim().toLowerCase()
      : identifier.trim();
  return `${kind}:${bucket}:${normalized}`;
}

async function readScope(scope: string): Promise<{
  attempts: number;
  window_start: number;
} | null> {
  return getDatabase().prepare(
    `SELECT attempts, window_start FROM auth_rate_limits WHERE scope = ?`
  )
    .bind(scope)
    .first<{ attempts: number; window_start: number }>();
}

async function checkScoped(
  kind: AuthRateLimitKind,
  bucket: RateLimitBucket,
  identifier: string,
  maxAttempts: number
): Promise<RateLimitResult> {
  const scope = scopeKey(kind, bucket, identifier);
  const row = await readScope(scope);
  const now = Date.now();

  if (!row) return { ok: true };
  if (now - row.window_start >= WINDOW_MS) return { ok: true };

  if (row.attempts >= maxAttempts) {
    const retryAfterSec = Math.ceil(
      (row.window_start + WINDOW_MS - now) / 1000
    );
    return {
      ok: false,
      retryAfterSec: Math.max(retryAfterSec, 1),
      scope: bucket,
    };
  }

  return { ok: true };
}

/** @deprecated 仅邮箱维度；请改用 enforceAuthRateLimits */
export async function checkAuthRateLimit(
  kind: AuthRateLimitKind,
  email: string
): Promise<RateLimitResult> {
  return checkScoped(kind, "email", email, MAX_EMAIL_ATTEMPTS);
}

export async function enforceAuthRateLimits(
  kind: AuthRateLimitKind,
  ctx: { email?: string; ip: string | null }
): Promise<RateLimitResult> {
  if (ctx.email) {
    const emailLimit = await checkScoped(
      kind,
      "email",
      ctx.email,
      MAX_EMAIL_ATTEMPTS
    );
    if (!emailLimit.ok) return emailLimit;
  }
  if (ctx.ip) {
    const ipLimit = await checkScoped(kind, "ip", ctx.ip, MAX_IP_ATTEMPTS);
    if (!ipLimit.ok) return ipLimit;
  }
  return { ok: true };
}

async function recordScoped(
  kind: AuthRateLimitKind,
  bucket: RateLimitBucket,
  identifier: string
): Promise<void> {
  const scope = scopeKey(kind, bucket, identifier);
  const now = Date.now();
  const row = await readScope(scope);

  if (!row || now - row.window_start >= WINDOW_MS) {
    await getDatabase().prepare(
      `INSERT INTO auth_rate_limits (scope, attempts, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(scope) DO UPDATE SET attempts = 1, window_start = excluded.window_start`
    )
      .bind(scope, now)
      .run();
    return;
  }

  await getDatabase().prepare(
    `UPDATE auth_rate_limits SET attempts = attempts + 1 WHERE scope = ?`
  )
    .bind(scope)
    .run();
}

export async function recordAuthFailures(
  kind: AuthRateLimitKind,
  ctx: { email?: string; ip: string | null }
): Promise<void> {
  if (ctx.email) await recordScoped(kind, "email", ctx.email);
  if (ctx.ip) await recordScoped(kind, "ip", ctx.ip);
}

/** @deprecated 请改用 recordAuthFailures */
export async function recordAuthFailure(
  kind: AuthRateLimitKind,
  email: string
): Promise<void> {
  await recordScoped(kind, "email", email);
}

async function clearScoped(
  kind: AuthRateLimitKind,
  bucket: RateLimitBucket,
  identifier: string
): Promise<void> {
  await getDatabase().prepare(`DELETE FROM auth_rate_limits WHERE scope = ?`)
    .bind(scopeKey(kind, bucket, identifier))
    .run();
}

export async function clearAuthRateLimits(
  kind: AuthRateLimitKind,
  ctx: { email?: string; ip: string | null }
): Promise<void> {
  if (ctx.email) await clearScoped(kind, "email", ctx.email);
  if (ctx.ip) await clearScoped(kind, "ip", ctx.ip);
}

/** @deprecated 请改用 clearAuthRateLimits */
export async function clearAuthRateLimit(
  kind: AuthRateLimitKind,
  email: string
): Promise<void> {
  await clearScoped(kind, "email", email);
}
