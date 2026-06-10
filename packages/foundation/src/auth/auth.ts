// Auth factory. Produces an `Auth` object whose methods are bound to the
// supplied `AuthConfig` and the current platform runtime. Internal helpers
// (session, users, rate-limit, turnstile) are pulled in by Task 3.2; for
// now the factory exposes a fully-typed surface with placeholder
// implementations so consumers can wire it up before the rest of the
// internals land.

import type { AuthConfig } from "../types";
import { getRuntimePlatform } from "../platform/current";
import type { RuntimePlatform } from "../platform/runtime";

/**
 * Minimal user shape. Expanded in Task 3.2 to mirror the full D1 row.
 */
export interface AuthUser {
  id: number;
  email: string;
  role: string | null;
}

/**
 * Minimal viewer shape returned by `requireViewer` / `requireRole`.
 * Expanded in Task 3.2 to include session info and role flags.
 */
export interface AuthViewer {
  id: number;
  email: string;
  role: string;
  isAdmin: boolean;
  isVip: boolean;
}

/**
 * Rate-limit verdict returned by `checkRateLimit`.
 */
export type AuthRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; scope: "email" | "ip" };

/**
 * Aggregate auth surface returned by `createAuth`. Each method is bound
 * to the configured database and cookie settings; consumers should not
 * need to pass these in again.
 */
export interface Auth {
  requireViewer(request: Request): Promise<{ user: AuthViewer }>;
  requireRole(
    request: Request,
    role: string
  ): Promise<{ user: AuthViewer }>;
  listUsers(): Promise<AuthUser[]>;
  setUserRole(userId: number, role: string): Promise<void>;
  checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<AuthRateLimitResult>;
  verifyTurnstile(
    token: string,
    ip: string | null
  ): Promise<boolean>;
}

function notImplemented(method: string): never {
  throw new Error(
    `createAuth: ${method} is not implemented yet. ` +
      `It will be wired up in Task 3.2 (move auth internals).`
  );
}

/**
 * Build an `Auth` object bound to `config` and the current platform
 * runtime. The returned methods share the same database/cookie context,
 * removing the need for module-level singletons.
 *
 * Runtime/database validation is deferred to the first call so callers
 * that only need the typed surface (e.g. tests) can still construct the
 * factory in environments without a configured D1 binding.
 */
export function createAuth(config: AuthConfig): Auth {
  // Resolve the runtime lazily so the factory can be constructed in
  // environments that do not have a real database (unit tests, build
  // steps, type-only imports). The real implementations in Task 3.2 will
  // assert on `runtime.database` and `config.databaseBinding` here.
  const getRuntime = (): RuntimePlatform => getRuntimePlatform();
  // Reference `config` so the parameter is not flagged as unused before
  // Task 3.2 wires the real implementations against it. Will be removed
  // once the helpers are in place.
  void config;

  return {
    async requireViewer(_request) {
      void getRuntime();
      notImplemented("requireViewer");
    },
    async requireRole(_request, _role) {
      void getRuntime();
      notImplemented("requireRole");
    },
    async listUsers() {
      void getRuntime();
      notImplemented("listUsers");
    },
    async setUserRole(_userId, _role) {
      void getRuntime();
      notImplemented("setUserRole");
    },
    async checkRateLimit(_key, _limit, _windowMs) {
      void getRuntime();
      notImplemented("checkRateLimit");
    },
    async verifyTurnstile(_token, _ip) {
      void getRuntime();
      notImplemented("verifyTurnstile");
    },
  };
}
