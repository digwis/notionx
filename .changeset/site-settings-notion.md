---
"@notionx/create-nextion-app": minor
---

Scaffold a separate Notion data source for site-level config (name, tagline, description, default locale, social image). The generated `lib/site/settings.ts` reads it through a 5-minute KV-cached loader and falls back to the hard-coded values in `lib/site/config.ts` whenever the data source is empty or Notion is unreachable. The home page / `generateMetadata` now use `getSiteSettings()` and the home page sets `title: { absolute }` to avoid the `name · name` template repetition. A `--no-site-settings` CLI flag (also `CREATE_NEXTION_NO_SITE_SETTINGS` env var) lets operators opt out and keep site config hard-coded.

Also fixes three pre-existing `tsc` errors in the scaffolder itself: `provision/notion.ts` re-imports the `runNtn` / `runOrThrowNtn` helpers from `shell.ts`; `provision/password-hash.ts` is created (PBKDF2-SHA256 100k iterations, wire format compatible with `@notionx/core`'s `hashPassword`); `p.select<UiPreset>` in `prompt.ts` is rewritten to let TypeScript infer both type parameters from the `options` array.
