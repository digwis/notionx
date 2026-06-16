# notionx — Codex (AGENTS.md) rule

> Designed for OpenAI Codex CLI / IDE. Drop this content into `AGENTS.md`
> (project root for project-scope, `~/.codex/AGENTS.md` for user-scope).
> The official installer does this for you: `npx @notionx/skill install
> --target codex --scope project`.

This project is a **notionx** site: a Next.js App Router app running on
Cloudflare Workers, with Notion as the CMS. The reusable platform lives in
`@notionx/core`; the scaffolder is `@notionx/create-notionx-app`.

Older prompts may say **vinext**. Treat that as notionx when the project imports
`@notionx/core` or calls `createNotionxWorker`. "Domain" means a content module
such as blog, movies, courses, or books, not DNS domain.

You are NOT working on a plain Next.js app. `@notionx/core` is a package
that implements auth, admin, D1, R2, Notion sync, webhooks, search, and
doctor. This project declares configuration; the package provides behavior.

## Required reading (in order)

1. `.notionx/scaffold.json` if present — scaffold version, initial content
   source, UI preset, locales, and `@notionx/core` dependency spec.
2. `package.json` — scripts, Node >= 22, `@notionx/core`, vinext.
3. `worker/index.ts` — the `createNotionxWorker({...})` call. Tells you which
   `sources`, `adminNav`, `authConfig`, `siteConfig` are wired.
4. `lib/content/models.ts` — `defineContentSource(...)` calls and exported
   `contentSources` registry.
5. `lib/admin/nav.ts` — admin sidebar, filtered by role.
6. `lib/auth.config.ts` — D1 binding, table names, cookie, Turnstile, email,
   OAuth toggles.
7. `lib/site/config.ts` and `lib/pages/*` — site name, locales, navigation,
   Notion-backed generic pages.
8. `wrangler.jsonc` — Cloudflare bindings (D1, KV, R2, Queue, Cron, vars).
9. `.dev.vars` (gitignored) — local secrets mirror of needed vars.

## Key commands

| Goal | Command |
|---|---|
| Create a new project | `pnpm create notionx-app my-new-site` |
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Tests | `pnpm test` |
| Offline diagnostics | `pnpm notionx:doctor` |
| Sync scaffold-owned files | `npx notionx update` |
| Repair Notion / CF resources | `npx notionx provision repair` |
| Apply D1 migrations (prod) | `pnpm exec wrangler d1 migrations apply <db> --remote` |
| Deploy | `pnpm exec vinext deploy` |

## Four contracts (the heart of every notionx project)

Every consumer of `@notionx/core` interacts with it through four TypeScript
contracts. Once you can read them, you can read any notionx project.

| Contract | File | Built with |
|---|---|---|
| `ContentSource` | `src/content/models.ts` | `defineContentSource({ id, kind, visibility, source, routes, ui, capabilities })` |
| `AuthConfig` | `src/types.ts` | D1 binding, auth tables, cookie, Turnstile, email, OAuth, roles |
| `AdminNavItem[]` | `admin/nav.ts` | `createAdminNav([...])` with sidebar items |
| `FoundationWorkerOptions` | `worker/bootstrap.ts` | passed to `createNotionxWorker({...})` |

The package implements the runtime; the project supplies the config. Never
re-implement what the package already provides.

## Layer boundaries (do not violate)

`@notionx/core` is organised in 7 strictly downward layers. Importing
upwards breaks the package and is blocked by ESLint in CI:

```
util / types  →  i18n / hooks  →  platform / cache
   →  notion  →  content  →  auth  →  admin  →  worker
                email / storage / media are cross-cutting (level 5.5)
```

If a user is editing the **package** itself, never add an import that
points upwards. If they are editing a **consumer project**, you only see
the public subpaths declared in `package.json#exports` — anything else
is private.

## Common workflows

### A. Add a new content domain (e.g. "podcasts")

1. Create the Notion data source. Note its `dataSourceId`.
2. Add a new `defineContentSource({ id: "podcasts", ... })` in
   `lib/content/models.ts` and append it to the `contentSources` array.
3. Add `app/podcasts/page.tsx` (list) and `app/podcasts/[slug]/page.tsx`
   (detail).
4. Add public API routes only if JSON consumers need them.
5. Optionally add an admin review page in `app/admin/podcasts/page.tsx`
   and register it in `lib/admin/nav.ts`.
6. Add the env var (e.g. `NOTION_PODCASTS_DATA_SOURCE_ID`) to both
   `.dev.vars`, `.dev.vars.example`, and `wrangler.jsonc#vars`.
7. Restart `pnpm dev`. Visit `/admin/content-models` to confirm the
   source is registered.

### B. Upgrade `@notionx/core`

1. `pnpm update @notionx/core`
2. Read
   [Notionx Changelog](https://github.com/digwis/nextion/blob/main/docs/architecture/notionx-changelog.md)
   for breaking changes.
3. `pnpm test && pnpm dev` — verify `/admin/content-models`, `/login`,
   `/api/health`.
4. If the release notes mention D1 schema changes:
   `pnpm exec wrangler d1 migrations apply <db> --remote`.
5. If scaffold-owned files drifted: `npx notionx update`.
6. If bindings / Notion / Turnstile / Resend drifted:
   `npx notionx provision repair`.

### C. Diagnose a broken project

Always start with `pnpm notionx:doctor`. It is offline, never prints
secrets, and surfaces: missing bindings, missing env vars, undeclared
content sources, stale `wrangler.jsonc`. Only after doctor passes should
you go into source.

If a specific symptom matches a recipe in the upstream troubleshooting
guide, follow it before guessing:
https://github.com/digwis/nextion/blob/main/skills/notionx/references/troubleshooting.md

## Anti-patterns (refuse these)

- **Re-implementing auth / admin / Notion sync in a consumer project.**
  That is what `@notionx/core` is for. If you find yourself writing D1
  auth SQL in the consumer, you are off-pattern.
- **Importing internal paths from `@notionx/core`.** Only use the
  subpaths declared in `package.json#exports`. Anything under
  `src/internal/` is intentionally inaccessible.
- **Adding a content source without registering it in `contentSources` and
  worker sources.** Defining the model alone is not enough.
- **Editing `apps/moviebluebook` to "fix" a consumer project.** The
  reference app is the canary. Fixes go into `@notionx/core`, then
  propagate via `pnpm update`.
- **Hard-coding secrets in `wrangler.jsonc`.** Use `wrangler secret put`
  or `.dev.vars` locally.
- **Adding JSON blueprints or runtime theme/plugin registries** for ordinary
  content customization. Build content domains as source-code modules.

## Where to look when debugging

| Symptom | Look in |
|---|---|
| Auth not working | `lib/auth.config.ts`, then `@notionx/core/auth/*` |
| Notion sync broken | `lib/content/models.ts`, then `@notionx/core/notion/*` |
| Webhook not firing | `@notionx/core/notion/routes/webhook.ts`, then `wrangler.jsonc` |
| Admin page 404 | `lib/admin/nav.ts` (is it registered?) |
| Build fails | `@notionx/core` exports list (`node_modules/@notionx/core/package.json`) |
| Cache not invalidating | `lib/content/models.ts` `routes.*`, then `@notionx/core/content/revalidate.ts` |

## Deep references

For the full guides referenced above (architecture, content-source and domain
module workflows, deploy & CI, troubleshooting recipes, four-contracts detail),
see:
https://github.com/digwis/nextion/tree/main/skills/notionx/references
