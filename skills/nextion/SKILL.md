---
name: "nextion"
description: "nextion is a Next.js App Router framework running on Cloudflare Workers via vinext, with Notion as the CMS and @notionx/core providing auth, admin, D1/R2, media routes, content registration, search, and diagnostics. Invoke when the user wants to create or update a nextion/vinext project, scaffold with `pnpm create nextion-app`, add/replace/remove/customize a Notion-backed content source (`defineContentSource`, routes, APIs, domain UI, search/sort/filter), run `pnpm nextion:doctor`, upgrade `@notionx/core`, run `nextion update` or `nextion provision repair`, configure Cloudflare / Notion / Turnstile / Resend / Google OAuth, or debug deploy / webhook / cache / auth issues in a nextion-based project. Do NOT invoke for plain Next.js apps, plain Cloudflare Workers without the nextion wrapper, or for editing Notion content itself."
---

# nextion

Use this skill to work on modern **nextion** projects and the nextion monorepo.
nextion has two moving parts:

- `@notionx/core`: reusable runtime/platform package in `packages/nextion/src`.
- `@notionx/create-nextion-app`: scaffolder and maintenance CLI in
  `packages/create-nextion-app/src`, including `nextion update` and
  `nextion provision repair`.

Consumer projects are regular source-code apps. They configure the package and
own their Notion content sources, routes, components, site config, shadcn/ui
source, Cloudflare bindings, and migrations. Older prompts may still say
**vinext**; treat that as nextion when the repo imports `@notionx/core` or has
`createNextionWorker`. The old `vinext-domain-builder` skill was about content
domains, meaning content modules such as blog, movies, courses, or books, not
DNS domains.

## Required reading

For a consumer project, read in this order:

1. `.nextion/scaffold.json` if present — scaffold version, initial content
   source, UI preset, locales, and `@notionx/core` dependency spec.
2. `package.json` — confirms scripts, `@notionx/core`, vinext, Node >= 22.
3. `worker/index.ts` — calls `createNextionWorker(...)` before falling through
   to `vinext/server/app-router-entry`; shows `sources`, `adminNav`,
   `authConfig`, and `siteConfig` wiring.
4. `lib/content/models.ts` — `defineContentSource(...)` calls and the exported
   `contentSources` registry.
5. `lib/admin/nav.ts` — admin sidebar entries via `createAdminNav`.
6. `lib/auth.config.ts` — D1 binding, auth table names, session cookie,
   Turnstile, email, OAuth, roles, password policy.
7. `lib/site/config.ts` and `lib/pages/*` — site navigation and Notion-backed
   generic pages.
8. `wrangler.jsonc`, `.dev.vars.example`, `.dev.vars` — bindings, vars, and
   local secrets. Never print secrets.

For the nextion monorepo itself, use these as authority:

- Runtime code: `packages/nextion/src/**`.
- Scaffolder/update/provision code: `packages/create-nextion-app/src/**`.
- Current docs: `docs/architecture/nextion-package.md`,
  `creating-new-project.md`, `customizing-content-source.md`, and
  `upgrading-nextion.md`.
- Do not treat `docs/architecture/content-nextion.md` as current authority; it
  documents the pre-package foundation split.

## Current contracts

Every project mostly touches four boundaries:

| Boundary | Source | Project role |
|---|---|---|
| `ContentSource` | `@notionx/core/content` | Declare Notion source fields, routes, labels, capabilities. |
| `AuthConfig` | `@notionx/core/types` | Configure D1 binding, auth tables, cookie, Turnstile, email, OAuth, roles. |
| `AdminNavItem[]` | `@notionx/core/admin` | Declare project admin sidebar entries with `createAdminNav([...])`. |
| `FoundationWorkerOptions` | `@notionx/core/worker` | Pass `sources`, `adminNav`, `authConfig`, `siteConfig`, optional route hooks to `createNextionWorker`. |

Load [references/four-contracts.md](references/four-contracts.md) before
editing these shapes. If this skill conflicts with source code, trust source
code and update the skill.

## Commands

| Goal | Command |
|---|---|
| Create project | `pnpm create nextion-app my-new-site` |
| Non-interactive scaffold | `pnpm create nextion-app my-site -- --project-name my-site --admin-email admin@example.com --yes` |
| Install deps | `pnpm install` |
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Tests | `pnpm test` |
| Typecheck / lint | `pnpm typecheck && pnpm lint` |
| Offline diagnostics | `pnpm nextion:doctor` |
| Sync scaffold-owned files | `npx nextion update` |
| Repair Notion / Cloudflare resources | `npx nextion provision repair` |
| Apply D1 migrations | `pnpm exec wrangler d1 migrations apply <db> --remote` |
| Deploy | `pnpm exec vinext deploy` or `pnpm deploy` when scripted |

`nextion update` requires `.nextion/scaffold.json` and currently manages only
`package.json`, `wrangler.jsonc`, `README.md`, `.nextion/scaffold.json`, and
`.dev.vars.example`. It is not a broad source-code rewrite tool.

## Workflows

### Create or update a project

Use `pnpm create nextion-app`. The generated project includes vinext scripts,
`worker/index.ts`, auth/admin route re-exports, shadcn/Tailwind source, Notion
page helpers, migrations, `.nextion/scaffold.json`, and a first content source.
For current scaffold behavior, read
[references/architecture.md](references/architecture.md) and the templates in
`packages/create-nextion-app/src/templates`.

### Add or change a content source

For anything beyond a tiny field rename, load
[references/domain-module.md](references/domain-module.md) and
[references/content-source.md](references/content-source.md). The short path:

1. Create or inspect the Notion data source and record its data source id.
2. Add `defineContentSource({...})` in `lib/content/models.ts`.
3. Append it to `contentSources` and wire it into `worker/index.ts` if that file
   imports individual sources instead of the array.
4. Add domain-owned public pages, optional APIs, optional admin pages, UI
   components, tests, and docs.
5. Add env vars to `.dev.vars`, `wrangler.jsonc#vars`, and env examples.
6. Verify `/admin/content-models`, public routes, cache/webhook assumptions,
   search/filter behavior, and privacy of public API fields.

Keep the old useful vinext rule: a content source is a code module. Do not add
JSON blueprint generators, generic preset registries, runtime theme/plugin
marketplaces, or layout config inside `defineContentSource` unless the user
explicitly asks for that product.

### Upgrade or repair

Use this order when nextion changes:

1. Runtime dependency change: `pnpm update @notionx/core`.
2. Scaffold/config/template drift: `npx nextion update`.
3. Notion schema, Cloudflare bindings, secrets, or resource drift:
   `npx nextion provision repair`.
4. Only deploy after local tests and doctor pass.

Read [references/deploy.md](references/deploy.md) and
[references/troubleshooting.md](references/troubleshooting.md) for release and
failure handling.

## Package layer guardrails

When editing `@notionx/core`, imports only go down the layer stack:

```text
util / types -> i18n / hooks -> platform / cache
  -> notion -> content -> auth -> admin -> worker
              email / storage / media are cross-cutting
```

Consumer projects must import only public subpaths declared in
`@notionx/core/package.json#exports`, such as `@notionx/core/content`,
`@notionx/core/notion`, `@notionx/core/pages`, `@notionx/core/admin`,
`@notionx/core/auth/routes/viewer`, and `@notionx/core/worker`. Do not import
`src/internal/*` or random package source paths from a consumer project.

## Anti-patterns

- Re-implementing package-owned auth, admin shell, Notion media, storage, or
  worker routes in a consumer project.
- Adding a `defineContentSource` value without registering it in
  `contentSources` or `worker/index.ts`.
- Putting UI layout templates, theme presets, or runtime page-builder config in
  `ContentSource`; keep presentation in React/Tailwind/shadcn source.
- Editing `apps/moviebluebook` to fix an external consumer. Fix package bugs in
  `@notionx/core`, then update consumers.
- Hard-coding secrets in `wrangler.jsonc`, source files, docs, or output.
- Treating `nextion update` as permission to overwrite arbitrary user code.

## References

- Architecture: [references/architecture.md](references/architecture.md)
- Four contracts: [references/four-contracts.md](references/four-contracts.md)
- Content source workflow: [references/content-source.md](references/content-source.md)
- Domain module convention: [references/domain-module.md](references/domain-module.md)
- Deploy and CI: [references/deploy.md](references/deploy.md)
- Troubleshooting: [references/troubleshooting.md](references/troubleshooting.md)
- Manual install: [INSTALL.md](INSTALL.md)
