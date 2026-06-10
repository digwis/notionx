# Foundation Package Design

## Summary

This design splits the current vinext starter into a reusable `@nextion/core`
npm package plus a thin starter application. The package owns the platform,
authentication, admin framework, and Notion helpers. The starter (and every
future project that consumes the package) owns its own content sources, public
routes, domain-specific admin pages, migrations, and Cloudflare bindings.

The development model is a single pnpm monorepo; the distribution model is a
private npm package published to GitHub Packages. Projects consume the
package as a normal dependency and pick up foundation upgrades through
Dependabot or a similar dependency-update bot.

The goal is to make "new project" mean "define Notion fields + write routes +
style the UI", with auth, email, verification, admin shell, platform adapters,
caching, and the foundation doctor already wired in by the package.

## Goals

- Separate the reusable platform from the current starter's content domains.
- Make the foundation consumable as a real npm dependency that auto-upgrades.
- Keep AI-friendly, code-first project structure (no JSON blueprints, no
  forced generic UI for every domain).
- Preserve every existing capability: Notion content sources, D1 auth,
  sessions, OAuth, Turnstile, Resend, R2, Cloudflare Images, revalidation,
  search, admin users, admin settings, content-models status page, foundation
  doctor, Cloudflare Workers deployment.
- Allow new projects to ship a working auth flow + admin shell + content
  registration with a few dozen lines of code instead of dozens of files.
- Provide a `pnpm create nextion-app` scaffolder so new projects are one
  command away.

## Non-Goals

- Migrating non-blog, non-movie content into the package. The package exposes
  contracts; concrete domains stay in projects.
- Replacing the shadcn/ui copy-paste workflow. Primitives stay in the starter
  so AI can edit them per project.
- Adding a low-code content builder or visual editor on top of the package.
- Supporting multiple runtimes. The package is Cloudflare-Workers-only on
  vinext, matching the current architecture.
- Building a private npm registry from scratch. We use GitHub Packages.
- Adding Turborepo or Nx in v1. pnpm workspace is enough for two packages.
  We add Turborepo only if/when the repo grows to 4+ packages or CI cost
  becomes noticeable.

## Current State

The current repository is a single Next.js + vinext application that mixes
foundation code and concrete domains in the same source tree:

- `lib/platform/` — Cloudflare runtime, capabilities, current facade.
- `lib/notion/` — Notion client, mappers, blocks, media, webhooks. Includes
  domain-specific helpers like `posts.ts` and `movies.ts`.
- `lib/content/` — content source registry with two registered sources: blog
  and movies.
- `lib/foundation/` — `doctor.ts` plus its CLI entry under `scripts/`.
- `lib/auth.ts`, `session.ts`, `passwords.ts`, `users.ts`,
  `auth-rate-limit.ts`, `turnstile.ts` — D1-backed authentication.
- `lib/email.ts` — Resend wrapper.
- `lib/storage.ts`, `cache-keys.ts`, `public-image.ts` — R2 and cache helpers.
- `app/login/`, `app/register/`, `app/forgot-password/`, `app/reset-password/`
  — auth UI pages.
- `app/admin/` — admin shell, user management, settings, content-models
  status page, plus domain-specific review queue, edit form, new form, and
  detail pages.
- `app/api/auth/*`, `app/api/notion/*`, `app/api/files`, `app/api/cdn`,
  `app/api/content/*`, `app/api/health` — API routes.
- `app/blog/`, `app/movies/` — public content routes for two concrete
  domains.
- `worker/index.ts` — the Cloudflare Worker entry point.
- `migrations/` — D1 schema, including auth, sessions, subscribers, and
  content-specific tables.
- `components/ui/` — shadcn primitives.

The current architecture doc (`docs/architecture/content-nextion.md`)
already states that "for copied projects, replacing a domain means deleting
the old domain-owned routes, APIs, mappers, components, docs, tests, env
references, sitemap entries, and cache/webhook assumptions while preserving
the foundation." This design is the mechanical realization of that intent.

## Proposed Architecture

### Repository Layout

A single pnpm workspace holds the package and the starter application. We
add Turborepo later only when the package count or build cost justifies it.

```
vinext-monorepo/
├── packages/
│   └── foundation/                # Published as @nextion/core
│       ├── src/
│       │   ├── platform/          # Cloudflare runtime + capabilities
│       │   ├── notion/            # Notion client + generic helpers
│       │   ├── content/           # ContentSource contract, registry, revalidate, search
│       │   ├── auth/              # D1 auth, sessions, passwords, Turnstile, rate-limit
│       │   ├── admin/             # AdminShell, sidebar, layout, user mgmt, settings, content-models
│       │   ├── storage/           # R2 helpers, /api/files, /api/cdn
│       │   ├── media/             # Notion media proxy, public-image
│       │   ├── cache/             # cache-keys, public cache invalidation
│       │   ├── email/             # Resend wrapper
│       │   ├── worker/            # createNextionWorker + middleware
│       │   ├── doctor/            # nextion:doctor
│       │   ├── i18n/              # config + default messages
│       │   ├── util/              # env, site-url, request-ip, utils
│       │   ├── hooks/             # useAuthViewer, useMobile
│       │   └── types.ts           # ContentSource, AuthConfig, AdminExtension, WorkerOptions
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts         # ESM + CJS + d.ts bundling
├── apps/
│   └── starter/                   # The current root, moved here
│       ├── app/                   # blog/, movies/, admin/ (domain subpages only), page.tsx
│       ├── lib/
│       │   ├── content/           # defineContentSource(blog, ...) + defineContentSource(movies, ...)
│       │   ├── admin/nav.ts       # createAdminNav([...])
│       │   ├── auth.config.ts     # AuthConfig object
│       │   └── site/config.ts
│       ├── components/            # shadcn/ui primitives + project components
│       ├── migrations/            # D1 schema including auth tables + content tables
│       ├── public/
│       ├── wrangler.jsonc
│       ├── vite.config.ts
│       ├── next.config.ts
│       └── package.json           # depends on "@nextion/core": "workspace:*"
├── pnpm-workspace.yaml
├── package.json                   # Root scripts: pnpm -r build, pnpm -r test
├── .changeset/                    # Versioning
└── .github/workflows/
    ├── release.yml                # Publish to GitHub Packages on main
    └── ci.yml                     # Build + test foundation + starter
```

### Package Public API

The package exports are split by subpath so projects tree-shake cleanly.

```ts
// @nextion/core/platform
export { getCurrentRuntime } from './current'
export { capabilities } from './capabilities'
export type { Runtime, RuntimeEnv } from './runtime'

// @nextion/core/notion
export { createNotionClient, getNotionClient } from './client'
export { listPages, queryDataSource } from './query'
export { mapPageToRecord, defineMapper } from './mappers'
export { renderNotionBlocks } from './blocks'
export { extractPlainText, extractRichText } from './block-text'
export { proxyNotionMedia, getNotionMediaCacheKey } from './media'
export { parseNotionWebhook, verifyNotionSignature } from './webhook'
export type { NotionClient, NotionConfig, Block } from './types'

// @nextion/core/content
export { defineContentSource } from './models'
export { revalidateContentModel, getRevalidationPaths } from './revalidate'
export { prewarmContentModel } from './prewarm'
export { searchContentModel } from './search'
export { buildSearchIndex } from './search-index'
export { summarizeAdmin } from './admin-summary'
export type { ContentSource, ContentContext, ContentCapabilities } from './types'

// @nextion/core/auth
export { createAuth, requireViewer, requireRole } from './auth'
export { getViewer } from './session'
export { hashPassword, verifyPassword } from './passwords'
export { listUsers, setUserRole } from './users'
export { checkAuthRateLimit } from './rate-limit'
export { verifyTurnstile } from './turnstile'
export { authRoutes } from './routes'             // /api/auth/login, register, etc.
export type { AuthConfig, Viewer, Role } from './types'

// @nextion/core/admin
export { AdminShell, AdminLayout, AdminSidebar, AdminHeader } from './shell'
export { createAdminNav } from './nav'
export { registerAdminExtension } from './registry'
export { UserManagementPage, SettingsPage, ContentModelsPage } from './pages'
export { authPages } from './auth-pages'          // /login, /register, /forgot-password, /reset-password
export type { AdminExtension, AdminNavItem, AdminPageContext } from './types'

// @nextion/core/storage
export { getObject, putObject, getPublicUrl } from './r2'
export { storageRoutes } from './routes'          // /api/files, /api/cdn

// @nextion/core/media
export { proxyPublicImage, optimizeImage } from './public-image'
export { mediaRoutes } from './routes'            // /api/notion/media/[...ref]

// @nextion/core/cache
export { getCacheKey, buildCacheKey } from './cache-keys'
export { contentRevalidateRoute, contentPrewarmRoute } from './routes'

// @nextion/core/email
export { sendEmail, ResendEmail } from './resend'

// @nextion/core/worker
export { createNextionWorker } from './bootstrap'
export { nextionMiddleware } from './middleware'
export { healthRoute } from './routes'

// @nextion/core/doctor
export { runNextionDoctor } from './doctor'

// @nextion/core/hooks
export { useAuthViewer } from './use-auth-viewer'
export { useMobile } from './use-mobile'

// @nextion/core/types
export type {
  ContentSource,
  AuthConfig,
  AdminExtension,
  AdminNavItem,
  WorkerOptions,
  FoundationConfig,
} from './types'
```

### Boundary Contracts

Projects consume the package through four contracts. Each is a TypeScript
interface exported from `@nextion/core/types`.

#### `ContentSource`

Declares one Notion-backed content domain. The package reads this object to
auto-wire list routes, detail routes, cache keys, revalidation paths,
webhook routing, and search indexing.

```ts
export interface ContentSource {
  id: string
  source: {
    tokenEnv: string
    dataSourceEnv: string
    fields: {
      title: string
      slug: string
      status?: string
      published?: string
      description?: string
      date?: string
      cover?: string
      author?: string
      tags?: string
      [k: string]: string | undefined
    }
    queryDefaults?: {
      sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>
      pageSize?: number
      filter?: unknown
    }
  }
  routes: {
    list: string
    detail: (slug: string) => string
    api?: string
  }
  ui: {
    labels: Record<string, { title: string; description: string; emptyState: string }>
  }
  capabilities?: {
    richBlocks?: boolean
    coverImage?: boolean
    gatedAssets?: boolean
  }
}
```

#### `AuthConfig`

Declares how the package's auth internals bind to Cloudflare resources.
The package implements the entire auth flow; the project supplies
configuration.

```ts
export interface AuthConfig {
  databaseBinding: string
  // Table names live in the project's D1 schema. The package reads
  // whatever the project names them, so projects can prefix with their
  // own namespace (e.g., 'app_users', 'app_sessions').
  tables: {
    users: string
    sessions: string
    passwordResets: string
    emailVerifications: string
    authRateLimits: string
  }
  sessionCookie: {
    name: string
    maxAge: number
    secure: boolean
  }
  turnstile?: {
    siteKeyEnv: string
    secretKeyEnv: string
  }
  email?: {
    provider: 'resend'
    fromEnv: string
    apiKeyEnv: string
  }
  oauth?: {
    google?: {
      clientIdEnv: string
      clientSecretEnv: string
    }
  }
  roles: {
    default: string
    vip: string
    admin: string
  }
  password?: {
    minLength: number
  }
}
```

#### `AdminExtension`

Adds nav items and shell extensions. Pages still live as file routes under
`app/admin/<slug>/page.tsx`; the extension only registers them in the
sidebar with role checks.

```ts
export interface AdminNavItem {
  href: string
  labelKey: string
  icon?: string
  requireRole?: string
  group?: string
  order?: number
}

export interface AdminExtension {
  nav?: AdminNavItem[]
  extraShellComponents?: Array<{ slot: 'header' | 'footer' | 'sidebar'; component: ComponentType }>
}
```

Projects use a single `createAdminNav([...])` call from
`apps/starter/lib/admin/nav.ts`. The order and grouping in this array
determines the sidebar order.

#### `WorkerOptions`

The single object passed to `createNextionWorker()` at the worker entry
point. It aggregates content sources, admin extensions, auth config, and
site config.

```ts
export interface WorkerOptions {
  sources: ContentSource[]
  adminNav: AdminNavItem[]
  authConfig: AuthConfig
  siteConfig: {
    name: string
    description: string
    urlEnv?: string
    defaultLocale: string
    locales: string[]
    navigation: Array<{ href: string; labelKey: string }>
  }
  extraRoutes?: Record<string, () => Promise<{ default: RouteHandler }>>
}
```

### Configuration & Environment Strategy

The package reads environment through a small helper. Both old and
namespaced names work, with namespaced taking priority.

```ts
export function getEnv(primary: string, ...fallbacks: string[]): string | undefined
```

- Primary: `NOTION_TOKEN`, `TURNSTILE_SITE_KEY`, `RESEND_FROM`, etc.
- Optional override: `FOUNDATION_NOTION_TOKEN`, `FOUNDATION_TURNSTILE_SITE_KEY`, etc.
- Bindings: read via `getCurrentRuntime().getBinding('DB')`, never raw
  `process.env`.

Validation:

- **Required at boot**: `AuthConfig.databaseBinding` must resolve to a
  binding. Worker startup fails with a clear error otherwise.
- **Required on first route hit**: each `ContentSource.tokenEnv` and
  `dataSourceEnv` must resolve when that source is first accessed. The
  route returns HTTP 503 with a setup hint.
- **Optional**: Turnstile, Resend, Google OAuth. Routes that need them
  return 503 with a setup hint if the env is missing.

Business code never reads `process.env` directly. It always goes through
`getCurrentRuntime()`.

### Dependency Direction Rules

The package is organized in tiers. Imports must flow top-down only.

```
util, types                ← Tier 0: pure helpers, no internal deps
  ↑
i18n, hooks                ← Tier 1: depend on util/types only
  ↑
platform, cache            ← Tier 2: platform + cache primitives
  ↑
notion                     ← Tier 3: Notion client + generic helpers
  ↑
content                    ← Tier 4: ContentSource framework
  ↑
auth                       ← Tier 5: auth (depends on content for viewer)
  ↑
email, storage, media      ← Tier 5.5: cross-cutting services
  ↑
admin                      ← Tier 6: composes content + auth
  ↑
worker                     ← Tier 7: entry point
```

Forbidden imports (enforced by ESLint `import/no-restricted-paths`):

- `notion` may not import from `content`, `auth`, `admin`, or `worker`
- `content` may not import from `auth`, `admin`, or `worker`
- `auth` may not import from `admin` or `worker`
- `admin` may not import from `worker`
- Any package module may not import from `apps/starter` or
  `@nextion/core`'s `@internal/*` paths

Enforcement:

- `packages/nextion/eslint.config.mjs` configures
  `import/no-restricted-paths` with a `zone` per tier. Running
  `pnpm --filter @nextion/core lint` fails on any violation.
- `packages/nextion/package.json` `exports` field exposes only the
  documented subpaths. Internal modules are placed under `src/internal/`
  and excluded from `exports`. The `apps/starter` cannot import them
  even if it tries.
- A pre-commit hook (added in Phase 0) runs `pnpm -r lint` and
  `pnpm -r typecheck` on staged files.

### Distribution

The package is published to **GitHub Packages** under the
`@nextion/core` scope.

- Versioning: changesets. Each PR affecting `packages/nextion/**`
  includes a changeset file describing the change and a semver bump type.
- Release workflow (`.github/workflows/release.yml`): on push to `main`,
  if `packages/nextion/**` changed, run `pnpm changeset version`,
  `pnpm --filter @nextion/core build`, `pnpm changeset publish`
  using a `GITHUB_TOKEN` with `packages: write` permission.
- Consumer upgrade: each consumer project has a `.github/dependabot.yml`
  that opens PRs on `@nextion/core` minor and patch releases. PRs run
  consumer tests, and Dependabot auto-merge is enabled after tests pass.
  Major version bumps are reviewed manually.
- Optional `repository_dispatch` based auto-upgrade workflow is documented
  but disabled by default; it is the consumer's choice to enable it.

### What Stays in the Starter

| Item | Reason |
|---|---|
| `app/blog/`, `app/movies/`, future domains | Project business |
| `app/admin/{review,new,[slug]}/` and edit forms | Domain-specific admin |
| `app/page.tsx` and other landing pages | Project identity |
| `components/ui/` (shadcn primitives) | AI-editable per project |
| Domain-specific components (`MovieDownloadPanel`, `GatedVideo`, etc.) | Project business |
| `migrations/` initial schema | Project owns its D1 database, including the auth tables the package reads. The scaffolder copies a reference auth schema into the new project. |
| `lib/content/models.ts` (`defineContentSource` calls) | Per-project content registry |
| `lib/site/config.ts` | Per-project site config |
| `wrangler.jsonc`, `vite.config.ts`, `next.config.ts` | Per-project Cloudflare setup |
| `lib/admin/nav.ts` | Per-project admin extension |
| `lib/auth.config.ts` | Per-project auth config |
| `tsconfig.json` paths | Per-project TS setup |

### What Goes in the Package

| Item | Reason |
|---|---|
| `lib/platform/*` | Generic runtime facade |
| `lib/notion/{client,config,blocks,block-text,content-cache,media,generic-source,property-mappers,types,webhook,mappers}.ts` | Generic Notion helpers |
| `lib/foundation/doctor.ts` + `scripts/foundation-doctor.mjs` | Diagnostic |
| `lib/auth.ts, session.ts, passwords.ts, users.ts, auth-rate-limit.ts, turnstile.ts` | Auth internals |
| `app/api/auth/*` | Auth API routes |
| `app/{login,register,forgot-password,reset-password}/` | Auth UI |
| `app/admin/{layout,users,settings,account,content-models,page,DeleteButton*}` | Admin framework |
| `app/api/notion/{webhook,media}`, `app/api/files`, `app/api/cdn`, `app/api/content/*`, `app/api/health` | Generic API routes |
| `lib/cache-keys.ts, public-image.ts, storage.ts, email.ts, env.ts, site-url.ts, request-ip.ts, utils.ts` | Generic utilities |
| `lib/i18n/{config,messages}.ts` | Default i18n config |
| `lib/middleware.ts` | Foundation middleware |
|- `lib/content/{model,models,revalidate,prewarm,search,search-index,admin-summary}.ts` | Content framework (without domain registrations) |
| `worker/index.ts` → `createNextionWorker()` | Worker bootstrap |
| `hooks/{use-mobile.ts, useAuthViewer.ts}` | Generic hooks |

`lib/notion/posts.ts`, `lib/notion/movies.ts`, and `lib/notion/movie-*.ts`
stay in the starter because they encode domain knowledge.

## Migration Phases

Eight phases. Each phase is independently committable and reviewable. The
starter must remain runnable at the end of every phase.

### Phase 0: Skeleton

- Initialize pnpm workspace at the repo root.
- Create `packages/nextion/` with empty `package.json`, `tsconfig.json`,
  and `tsup.config.ts`.
- Move all current root files into `apps/starter/`.
- Update root `package.json` to be a workspace root with `pnpm -r` scripts.
- Add `pnpm-workspace.yaml` and `.npmrc` for pnpm.
- Add a minimal `packages/nextion/src/index.ts` placeholder so the
  package compiles.
- Configure `packages/nextion/eslint.config.mjs` with
  `import/no-restricted-paths` zones matching the tier rules in
  "Dependency Direction Rules". `pnpm --filter @nextion/core lint`
  must pass on the empty package.
- Configure `packages/nextion/package.json` `exports` field with the
  documented public subpaths; reserve `src/internal/` for modules that
  must not be importable from outside the package.
- Wire a pre-commit hook (Husky or simple git hook) that runs
  `pnpm -r lint` and `pnpm -r typecheck` on staged files.
- **Verification**: `cd apps/starter && npm run dev:vinext` starts;
  `npm test` passes.

### Phase 1: Leaf modules

Move into `packages/nextion/src/`:

- `lib/platform/runtime.ts`, `cloudflare-runtime.ts`, `capabilities.ts`,
  `current.ts`, `selection.ts`
- `lib/foundation/doctor.ts` (and `scripts/foundation-doctor.mjs`)
- `lib/i18n/config.ts`, `messages.ts`
- `lib/env.ts`, `site-url.ts`, `request-ip.ts`, `utils.ts`

Re-export from `apps/starter/lib/...` so existing imports keep working.

- **Verification**: foundation builds; `apps/starter` dev runs;
  `npm run nextion:doctor` returns the same output as before.

### Phase 2: Notion base

Move into `packages/nextion/src/notion/`:

- `client.ts`, `config.ts`, `blocks.ts`, `block-text.ts`,
  `content-cache.ts`, `media.ts`, `generic-source.ts`,
  `property-mappers.ts`, `types.ts`, `webhook.ts`, `mappers.ts`

Stay in `apps/starter/lib/notion/`:

- `posts.ts`, `movies.ts`, `movie-localized.ts`, `movie-translations.ts`,
  `movie-video-source.ts`

Switch `apps/starter` imports to use `@nextion/core/notion` for the
moved modules. Drop the re-exports at the end of this phase.

- **Verification**: blog list, blog detail, posts API, notion webhook
  all behave identically to before.

### Phase 3: Auth

Move into `packages/nextion/src/auth/`:

- `auth.ts`, `session.ts`, `passwords.ts`, `users.ts`,
  `auth-rate-limit.ts`, `turnstile.ts`
- All `app/api/auth/*` route handlers
- All `app/{login,register,forgot-password,reset-password}/` page modules
  (with their i18n messages)

Add `apps/starter/lib/auth.config.ts` exporting a real `AuthConfig` object.
Wire it through the new `createAuth({ ...authConfig })` factory.

- **Verification**: full register → verify email → login → forgot
  password → reset → logout flow works locally. Turnstile protects the
  register/login pages. Google OAuth callback still works.

### Phase 4: Admin framework

Move into `packages/nextion/src/admin/`:

- `app/admin/layout.tsx` (becomes `AdminShell`)
- `app/admin/users/`, `app/admin/settings/`, `app/admin/account/`,
  `app/admin/content-models/` (with the i18n keys they need)
- `app/admin/DeleteButton.tsx`, `DeleteButtonLazy.tsx`, `loading.tsx`,
  the dashboard `page.tsx`

Introduce `createAdminNav()` in `packages/nextion/src/admin/nav.ts`.
`apps/starter/lib/admin/nav.ts` exports a list including the starter's
project-specific entries (review queue, etc.).

- **Verification**: admin login, sidebar, role-based access, user
  management, settings save, content-models status page, foundation
  doctor admin equivalent all work.

### Phase 5: Cache, media, storage, worker, middleware

Move into the package:

- `lib/cache-keys.ts` → `src/cache/`
- `lib/public-image.ts` → `src/media/`
- `lib/storage.ts` → `src/storage/`
- `lib/email.ts` → `src/email/`
- All `app/api/notion/{webhook,media}`, `app/api/files`, `app/api/cdn`,
  `app/api/content/*`, `app/api/health` route handlers
- `worker/index.ts` → `src/worker/`, exposed via `createNextionWorker()`
- `lib/middleware.ts` → `src/middleware/`

`apps/starter/worker/index.ts` becomes a thin call:

```ts
import { createNextionWorker } from '@nextion/core/worker'
import { blogSource, moviesSource } from '../lib/content/models'
import adminNav from '../lib/admin/nav'
import authConfig from '../lib/auth.config'
import siteConfig from '../lib/site/config'

export default createNextionWorker({
  sources: [blogSource, moviesSource],
  adminNav,
  authConfig,
  siteConfig,
})
```

- **Verification**: every API route exercised in CI returns the same
  responses as before. Cloudflare staging deployment succeeds.

### Phase 6: Content abstraction

Move into `packages/nextion/src/content/`:

- `lib/content/model.ts`, `models.ts`, `revalidate.ts`, `prewarm.ts`,
  `search.ts`, `search-index.ts`, `admin-summary.ts`

Introduce the public `defineContentSource()` factory. It both constructs
the `ContentSource` object and registers it in the content registry in
one call. Migrate the existing blog and movies entries from the old
`ContentSource` shape to the new factory calls. The starter's
`lib/content/models.ts` is rewritten to call
`defineContentSource({...})` for each domain. The factory call returns
the source object so it can be passed into
`createNextionWorker({ sources: [blogSource, moviesSource] })`.

- **Verification**: register/register-update/unregister lifecycle tested
  with vitest. The `content-models` admin page reflects the live
  registration state correctly.

### Phase 7: Scaffolder and publishing

- Build a `create-nextion-app` CLI under `packages/create-nextion-app/` in the
  monorepo (a new private workspace). It prompts for project name, default
  locale, and first content source. It generates a fresh project skeleton
  with `wrangler.jsonc`, `migrations/`, `app/page.tsx`, an example
  `lib/content/models.ts`, and `lib/auth.config.ts` already wired up.
- Configure changesets in the repo root.
- Add `.github/workflows/release.yml` that:
  1. Triggers on push to `main` when `packages/nextion/**` changes.
  2. Runs `pnpm install` and `pnpm --filter @nextion/core build`.
  3. Runs `pnpm changeset version` and commits the version bump.
  4. Runs `pnpm changeset publish` with a `GITHUB_TOKEN` having
     `packages: write`.
- Add a docs page explaining how to install the scaffolder with
  `pnpm create nextion-app` and how to consume `@nextion/core` from a
  fresh project.
- **Verification**: scaffolder runs and produces a project that boots
  locally, has working auth, registers a sample content source, and
  deploys to a throwaway Cloudflare Worker.

### Phase 8: Documentation

- `docs/architecture/nextion-package.md` — design overview.
- `docs/architecture/creating-new-project.md` — using the scaffolder.
- `docs/architecture/customizing-content-source.md` — adding or
  changing content domains.
- `docs/architecture/upgrading-nextion.md` — Dependabot config and
  manual upgrades.
- `docs/architecture/nextion-changelog.md` — anchor point for
  release notes.
- Update top-level `README.md` to point at the new architecture
  documents and the scaffolder.

## Verification Checklist (per phase)

```bash
# In apps/starter
npm install
npm test
npm run build:vinext
npm run dev:vinext    # manually: register, login, view blog, view movie
npm run nextion:doctor
npm run deploy:remote -- --dry-run   # validates wrangler config
```

Plus for Phase 7:

```bash
# Generate a fresh project from the scaffolder
pnpm create nextion-app test-project
cd test-project
npm install
npm test
npm run dev:vinext
```

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `vinext` API may change in the near term | Isolate `vinext` calls in `src/worker/` and `src/platform/`; keep them version-pinned in foundation. |
| Cloudflare bindings may not resolve across monorepo paths | Phase 0 verifies vite-plugin resolution before any code moves. |
| Cross-package TypeScript paths may break `tsc` | Set up `tsconfig.json` `references` and `paths` in Phase 0; verify with `pnpm -r typecheck`. |
| Circular dependency between admin, auth, and content | Layering: util → platform → notion → content → auth → admin → worker. Enforce with ESLint `import/no-cycle`. |
| Tests need to run across packages | Vitest workspace config in Phase 0; shared fixtures live in the package as exported helpers. |
| shadcn primitives are coupled to the starter | Do not import `components/ui/*` from the package; the package only depends on Radix/lucide. |
| Consumers cannot customize admin internals easily | Expose `registerAdminExtension` with a documented `extraShellComponents` slot. |
| Changeset bot noise on the monorepo | Only changesets touching `packages/nextion/**` are required; use the `private-package` config to skip other workspaces. |
| Publishing a broken build to GitHub Packages | CI runs `pnpm --filter @nextion/core build` and the consumer's tests against the candidate before publish. |
| Existing project migration friction | Phase 0–1 keep every import re-exported. Drop the re-exports only at the end of Phase 2. |

## Out of Scope / Future

- Adding Turborepo. Revisit when the package count grows or CI cost
  becomes noticeable.
- Adding Nx or a code-generator plugin system.
- Supporting other runtimes (Vercel Edge, Node, Bun). The package is
  Cloudflare Workers only.
- A visual content editor or page builder on top of the package.
- Per-project `lib/notion/` framework extension points beyond the
  `ContentSource` contract. If a future domain needs more, we add the
  extension point in v1.1.
- A hosted version of the foundation. The package is consumed via npm
  and deployed by the project to its own Cloudflare account.

## Open Questions

- Should `apps/starter` itself be published as a separate "starter
  template" repository, or stay inside the monorepo? Recommendation: stay
  inside the monorepo for now. We can split it later if a second
  in-monorepo app appears.
- Do we want a non-public registry (Verdaccio) for canary releases
  before publishing to GitHub Packages? Recommendation: no, use
  `pnpm changeset publish --tag=next` instead.
- Should the scaffolder live in the monorepo under `tools/` or in its
  own repo? Recommendation: in the monorepo under `tools/`, as a private
  workspace. Easier to evolve alongside the package.
