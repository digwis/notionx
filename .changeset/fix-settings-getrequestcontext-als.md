---
"@notionx/create-nextion-app": patch
---

Fix a vinext-deploy-crashing import in the `site` UI preset's
site-settings loader.

The template `lib/site/settings.ts` imported `getRequestContext` from
`"cloudflare:workers"`, but the `cloudflare:workers` module does not
export that name (verified against `@cloudflare/workers-types`
4.20260613.1 and `workerd` 2026-06-05). The resulting
`Uncaught SyntaxError: ... does not provide an export named
'getRequestContext'` aborted the worker boot, and `vinext deploy`
surfaced it as `exit 1`.

The fix replaces the broken import with a per-request
`AsyncLocalStorage` shim:

- New `lib/site/request-env.ts` exports `runWithRequestEnv(env, fn)`
  and `getRequestEnv()`, built on `node:async_hooks` (already enabled
  via the `nodejs_compat` flag in the generated `wrangler.jsonc`).
- `lib/site/settings.ts` now calls `getRequestEnv()?.CONTENT_CACHE`
  instead of `getRequestContext()`, with the same graceful-degrade
  behavior (returns `null` outside a request scope).
- `worker/index.ts` wraps the fetch body in
  `runWithRequestEnv(env, async () => ...)` so the ALS is populated
  for the request lifetime.

Three new render tests assert each of the three contract points so
the scaffolder can't regress to a `cloudflare:workers` import again.
