---
"@notionx/create-nextion-app": patch
---

Fix `vinext deploy` failure caused by missing `VINEXT_KV_CACHE` KV namespace.

- Add a second KV binding (`VINEXT_KV_CACHE`) to the scaffolded `wrangler.jsonc`. The scaffolding flow now also creates that namespace and patches the new `REPLACE_WITH_VINEXT_KV_NAMESPACE_ID` placeholder alongside the existing `CONTENT_CACHE` namespace.
- Wire `kvDataAdapter()` from `@vinext/cloudflare/cache/kv-data-adapter` into the scaffolded `vite.config.ts` via `vinext({ cache: { data: kvDataAdapter() } })`. The adapter is a config-time builder that returns a serializable descriptor — instantiation of the actual KV handler is deferred to the first request. `vinext@0.1.1`'s `vinext deploy` rejects any project that uses `export const revalidate` without a configured data cache adapter, so this is required for any future scaffolded page that opts into ISR.
- Add `@vinext/cloudflare` to the scaffolded `package.json` `devDependencies` (the adapter's runtime factory lives there).
- Status card now shows a separate "KV (cache)" row for the new namespace, distinct from the existing `CONTENT_CACHE` row.
