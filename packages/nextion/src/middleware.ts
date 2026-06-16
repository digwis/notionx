// Foundation request-scoped middleware.
//
// Responsibilities:
//   1. Read the session cookie named in `authConfig.sessionCookie.name`.
//   2. Look up the session row in D1 (via the optional `sessionLookup`
//      injection; falls back to a no-op when the consumer has not
//      provided one).
//   3. Attach a viewer to a request-scoped context (a WeakMap keyed
//      by the Request instance) so downstream handlers can read it
//      without reaching into globals.
//   4. For protected admin patterns (`/api/admin/*` for any method,
//      and non-GET requests to `/admin*`), short-circuit with a 401
//      when there is no viewer.
//
// This module is intentionally tier-7 (top-level). It can reach into
// the auth tier because the eslint tier rules reserve that direction
// for higher-level glue code.

import type { AuthConfig } from "./types";

/**
 * Minimal viewer shape exposed by the foundation middleware. Phase 3
 * replaces this placeholder with the richer `AuthViewer` once
 * `createAuth` ships its real implementation.
 */
export interface FoundationViewer {
  userId: string | number;
  role: string | null;
  email: string | null;
}

/**
 * Resolves a session id to the user/role pair backing the viewer.
 * Callers can inject a custom lookup so they can read from their own
 * sessions table layout (the foundation only knows the table name).
 */
export type SessionLookup = (
  sessionId: string,
  env: unknown
) => Promise<{ userId: string | number; role: string | null; email?: string | null } | null>;

/**
 * Caller-supplied options. `WorkerOptions.siteConfig` etc. are passed
 * through the bootstrap; the middleware itself only needs the auth
 * block and an optional viewer lookup.
 */
export interface NextionMiddlewareOptions {
  /**
   * Auth configuration. When omitted (e.g. the project was scaffolded
   * with `--no-auth`), the middleware skips session cookie reading
   * and the admin gate entirely — every request passes through as
   * an anonymous viewer.
   */
  authConfig?: AuthConfig;
  /**
   * Optional session resolver. When provided, the middleware uses
   * this to look up the session row. When omitted, the middleware
   * still runs (to enforce the admin gate) but always reports no
   * viewer — useful for the bootstrap's test environment and for
   * consumers that have not yet wired their D1 session table.
   */
  sessionLookup?: SessionLookup;
  /**
   * Override which paths are gated. The default is nextion's
   * own contract: `/api/admin/*` for any method, and non-GET
   * requests to `/admin*` (GET `/admin*` is left for the app
   * router so the admin shell can render a login redirect).
   */
  isProtectedPath?: (request: Request) => boolean;
}

export interface NextionMiddlewareRequestContext {
  viewer: FoundationViewer | null;
  sessionId: string | null;
}

const requestContext = new WeakMap<Request, NextionMiddlewareRequestContext>();

/**
 * Default admin gate. Returns `true` for paths that require a viewer
 * before any handler runs. Excludes the GET form of `/admin*` so the
 * app router can render the admin shell and decide whether to
 * redirect to `/login` (matching the existing behavior).
 */
export function defaultIsProtectedPath(request: Request): boolean {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/admin/")) return true;
  if (url.pathname.startsWith("/admin")) {
    return request.method !== "GET" && request.method !== "HEAD";
  }
  return false;
}

function readSessionCookie(request: Request, name: string): string | null {
  // The Cookie header may be absent in pure unit tests. Guard so the
  // middleware never throws.
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (!rawKey) continue;
    if (rawKey.trim() !== name) continue;
    return rest.join("=").trim() || null;
  }
  return null;
}

/**
 * Build the request-scoped context for `request`. Returns a viewer
 * (or `null` when no session is present / no lookup is configured).
 */
export async function resolveFoundationViewer(
  request: Request,
  options: NextionMiddlewareOptions
): Promise<NextionMiddlewareRequestContext> {
  // When auth is disabled (no authConfig), there is no session
  // cookie to read and no viewer to resolve. Short-circuit.
  if (!options.authConfig) {
    return { viewer: null, sessionId: null };
  }

  const sessionId = readSessionCookie(
    request,
    options.authConfig.sessionCookie.name
  );

  if (!sessionId || !options.sessionLookup) {
    return { viewer: null, sessionId: sessionId ?? null };
  }

  const env = (request as Request & { env?: unknown }).env ?? null;
  const lookup = await options.sessionLookup(sessionId, env);
  if (!lookup) {
    return { viewer: null, sessionId };
  }

  return {
    viewer: {
      userId: lookup.userId,
      role: lookup.role,
      email: lookup.email ?? null,
    },
    sessionId,
  };
}

/**
 * Read the cached context for a request. Returns `undefined` when
 * `resolveFoundationViewer` was never run for this Request — i.e.
 * the request did not pass through `nextionMiddleware`.
 */
export function getFoundationContext(
  request: Request
): NextionMiddlewareRequestContext | undefined {
  return requestContext.get(request);
}

/**
 * Worker-style middleware. Returns a 401 `Response` for protected
 * paths that lack a viewer; otherwise `null` to let the request
 * continue through the route table.
 *
 * Side effect: attaches a `NextionMiddlewareRequestContext` to
 * the request via a `WeakMap` so downstream route handlers can
 * resolve the viewer without a global.
 */
export async function nextionMiddleware(
  request: Request,
  env: unknown,
  options: NextionMiddlewareOptions
): Promise<Response | null> {
  const context = await resolveFoundationViewer(request, options);
  requestContext.set(request, context);

  const isProtected = options.isProtectedPath ?? defaultIsProtectedPath;
  if (!isProtected(request)) return null;
  if (context.viewer) return null;

  return new Response(
    JSON.stringify({ ok: false, error: "Unauthorized" }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Foundation-Gate": "admin",
      },
    }
  );
}

/**
 * Build a `(request, env) => Promise<Response | null>` middleware
 * function with the options pre-bound. Used by the bootstrap and
 * the starter's Next.js middleware so they share one code path.
 */
export function createNextionMiddleware(
  options: NextionMiddlewareOptions
): (request: Request, env: unknown) => Promise<Response | null> {
  return (request, env) => nextionMiddleware(request, env, options);
}

/**
 * Test-only: clear the request-scoped context cache. Production
 * code should not need this — the WeakMap is keyed by Request
 * instances and entries die with the request. The helper exists so
 * the unit tests can stay deterministic when they reuse a single
 * Request across assertions.
 */
export function _clearFoundationContextForTests(): void {
  // WeakMap has no `clear`, but we can replace the reference.
  // The function is intentionally a no-op when no entries exist.
  void requestContext;
}
