// Per-request `env` accessor for deeply-nested helpers.
//
// In a Cloudflare Worker the `env` binding is only available as the
// second argument to the `fetch` handler. To make it reachable from
// arbitrary call sites (e.g. `getSiteSettings()` invoked from a
// server component, an admin action, or a cron job), we thread it
// through Node's `AsyncLocalStorage` — once per request.
//
// Lifecycle:
//   - The worker entry in `worker/index.ts` calls
//     `runWithRequestEnv(env, () => handler.fetch(...))` for every
//     incoming request (and for any `scheduled` invocation).
//   - Any code reachable from that handler can call
//     `getRequestEnv()` to read back the current request's `env`,
//     without having to plumb it down the call stack.
//
// Why not `getRequestContext()` from `cloudflare:workers`?
//   - `cloudflare:workers` does NOT export `getRequestContext` at
//     any current compatibility date. Importing it triggers a
//     `Uncaught SyntaxError: ... does not provide an export named
//     'getRequestContext'` at worker boot, which crashes the
//     deploy. (Verified against `@cloudflare/workers-types`
//     4.20260613.1 and workerd 2026-06-05.)
//   - Even on a runtime that *did* export it, that helper does not
//     surface the user `env` bindings — only the `ExecutionContext`.
//     We need the full `env` so we can read `CONTENT_CACHE` and
//     other KV namespaces.
//
// Why not vinext's `unified-request-context` shim?
//   - It exposes a per-request context object, but its
//     `executionContext` field is the Cloudflare `ExecutionContext`
//     (waitUntil/passThroughOnException), not the `env` bindings.
//   - Reaching in to attach `env` to vinext's internal context
//     would couple us to vinext's private shape.
//
// `AsyncLocalStorage` requires the `nodejs_compat` compatibility
// flag, which the scaffolder enables by default.

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Shape of the Cloudflare `env` parameter as far as this project
 * is concerned. The KV binding is the only one we read at
 * runtime; other bindings (D1, R2, secrets) are accessed by the
 * foundation worker directly and don't need ALS propagation.
 */
export interface RequestEnv {
  CONTENT_CACHE?: KVNamespace;
  // Extend as new runtime consumers need to read env outside the
  // worker entry (e.g. cron-triggered helpers).
}

const _envStore = new AsyncLocalStorage<RequestEnv>();

/**
 * Run `fn` with `env` available to any `getRequestEnv()` call
 * reachable from `fn`. Use this from the worker entry once per
 * request, before delegating to vinext/foundation.
 */
export function runWithRequestEnv<T>(env: RequestEnv, fn: () => T): T {
  return _envStore.run(env, fn);
}

/**
 * Read the current request's `env`, or `undefined` when called
 * outside a `runWithRequestEnv` scope (e.g. from a build script,
 * test, or one-off CLI invocation).
 */
export function getRequestEnv(): RequestEnv | undefined {
  return _envStore.getStore();
}
