---
name: "notionx"
description: "notionx is a Next.js App Router framework running on Cloudflare Workers via vinext, with Notion as the CMS and @notionx/core providing auth, admin, D1/R2, media routes, content registration, search, and diagnostics. Invoke when the user wants to create or update a notionx/vinext project, scaffold with `npm create notionx@latest`, add/replace/remove/customize a Notion-backed content source (`defineContentSource`, routes, APIs, domain UI, search/sort/filter), run `pnpm notionx:doctor`, upgrade `@notionx/core`, run `notionx update` or `notionx provision repair`, configure Cloudflare / Notion / Turnstile / Resend / Google OAuth, or debug deploy / webhook / cache / auth issues in a notionx-based project. Do NOT invoke for plain Next.js apps, plain Cloudflare Workers without the notionx wrapper, or for editing Notion content itself."
---

# notionx

Use this skill to work on modern **notionx** projects and the notionx monorepo.
notionx has two moving parts:

- `@notionx/core`: reusable runtime/platform package in `packages/notionx/src`.
- `@notionx/cli`: scaffolder and maintenance CLI in
  `packages/notionx-cli/src`, including `notionx update` and
  `notionx provision repair`.

Consumer projects are regular source-code apps. They configure the package and
own their Notion content sources, routes, components, site config, shadcn/ui
source, Cloudflare bindings, and migrations. Older prompts may still say
**vinext**; treat that as notionx when the repo imports `@notionx/core` or has
`createNotionxWorker`. The old `vinext-domain-builder` skill was about content
domains, meaning content modules such as blog, movies, courses, or books, not
DNS domains.

## Required reading

For a consumer project, read in this order:

1. `.notionx/scaffold.json` if present — scaffold version, initial content
   source, UI preset, locales, and `@notionx/core` dependency spec.
2. `package.json` — confirms scripts, `@notionx/core`, vinext, Node >= 22.
3. `worker/index.ts` — calls `createNotionxWorker(...)` before falling through
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

For the notionx monorepo itself, use these as authority:

- Runtime code: `packages/notionx/src/**`.
- Scaffolder/update/provision code: `packages/notionx-cli/src/**`.
- Current docs: `docs/architecture/notionx-package.md`,
  `creating-new-project.md`, `customizing-content-source.md`, and
  `upgrading-notionx.md`.

## Current contracts

Every project mostly touches four boundaries:

| Boundary | Source | Project role |
|---|---|---|
| `ContentSource` | `@notionx/core/content` | Declare Notion source fields, routes, labels, capabilities. |
| `AuthConfig` | `@notionx/core/types` | Configure D1 binding, auth tables, cookie, Turnstile, email, OAuth, roles. |
| `AdminNavItem[]` | `@notionx/core/admin` | Declare project admin sidebar entries with `createAdminNav([...])`. |
| `FoundationWorkerOptions` | `@notionx/core/worker` | Pass `sources`, `adminNav`, `authConfig`, `siteConfig`, optional route hooks to `createNotionxWorker`. |

Load [references/four-contracts.md](references/four-contracts.md) before
editing these shapes. If this skill conflicts with source code, trust source
code and update the skill.

## Commands

| Goal | Command |
|---|---|
| Create project | `npm create notionx@latest my-new-site` |
| Non-interactive scaffold | `npm create notionx@latest my-site -- --project-name my-site --admin-email admin@example.com --yes` |
| Install deps | `pnpm install` |
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Tests | `pnpm test` |
| Typecheck / lint | `pnpm typecheck && pnpm lint` |
| Offline diagnostics | `pnpm notionx:doctor` |
| Sync scaffold-owned files | `npx notionx update` |
| Repair Notion / Cloudflare resources | `npx notionx provision repair` |
| Apply D1 migrations | `pnpm exec wrangler d1 migrations apply <db> --remote` |
| Deploy | `pnpm exec vinext deploy` or `pnpm deploy` when scripted |

`notionx update` requires `.notionx/scaffold.json` and currently manages only
`package.json`, `wrangler.jsonc`, `README.md`, `.notionx/scaffold.json`, and
`.dev.vars.example`. It is not a broad source-code rewrite tool.

## Workflows

### Create or update a project

Use `npm create notionx@latest`. The generated project includes vinext scripts,
`worker/index.ts`, auth/admin route re-exports, shadcn/Tailwind source, Notion
page helpers, migrations, `.notionx/scaffold.json`, and a first content source.
For current scaffold behavior, read
[references/architecture.md](references/architecture.md) and the templates in
`packages/notionx-cli/src/templates`.

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

Use this order when notionx changes:

1. Runtime dependency change: `pnpm update @notionx/core`.
2. Scaffold/config/template drift: `npx notionx update`.
3. Notion schema, Cloudflare bindings, secrets, or resource drift:
   `npx notionx provision repair`.
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
- Treating `notionx update` as permission to overwrite arbitrary user code.

## References

- Architecture: [references/architecture.md](references/architecture.md)
- Four contracts: [references/four-contracts.md](references/four-contracts.md)
- Content source workflow: [references/content-source.md](references/content-source.md)
- Domain module convention: [references/domain-module.md](references/domain-module.md)
- Deploy and CI: [references/deploy.md](references/deploy.md)
- Troubleshooting: [references/troubleshooting.md](references/troubleshooting.md)
- Manual install: [INSTALL.md](INSTALL.md)
