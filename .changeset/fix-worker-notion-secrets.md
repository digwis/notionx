---
"@notionx/create-nextion-app": patch
---

Fix deployed worker having no Notion env, which made every Notion-backed page render as "no posts".

The provision step wrote `NOTION_TOKEN` and `NOTION_DATA_SOURCE_ID` to `.dev.vars` (local `wrangler dev` only) but never called `wrangler secret put` to push them to the deployed worker. `readWorkerEnv()` therefore returned empty in production, `hasNotionModelConfig()` returned false, and `listGenericNotionContent()` short-circuited to `[]`. The status card looked fine and `vinext deploy` succeeded, so the failure was silent.

The provision step now also calls `setWorkerSecret("NOTION_TOKEN", ...)` and `setWorkerSecret("NOTION_DATA_SOURCE_ID", ...)` after the existing Turnstile push, matching the same best-effort pattern. Both are skipped silently with a hint to run the commands manually if `pnpm install` has not yet produced a working `wrangler` binary at secret-push time.
