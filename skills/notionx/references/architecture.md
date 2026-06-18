# Architecture reference

> This file is the **operational summary** an AI needs to navigate any notionx
> project.

## The two-package split

```
@notionx/core         ← compiled from packages/notionx/src/
                         published to npm as @notionx/core
                         contains: platform, notion, content, auth,
                                   admin, storage, media, cache, email,
                                   worker, doctor, i18n, util, hooks

@notionx/cli   ← compiled from packages/notionx-cli/src/
                                published to npm
                                contains: scaffolder, `notionx update`,
                                          `notionx provision` commands
```

A **consumer project** (what `npm create notionx@latest` produces) depends on
`@notionx/core` at runtime and uses vinext for the Cloudflare/Next.js app-router
server. `@notionx/cli` is invoked at scaffold time and later through the
`notionx` maintenance command for `notionx update` / `notionx provision repair`.

## Repository layout of a notionx project (consumer view)

```text
my-site/
├── app/
│   ├── (content)                  # public pages per content source
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   └── movies/...
│   ├── admin/                     # admin shell, auth-protected
│   │   ├── layout.tsx
│   │   ├── page.tsx               # dashboard
│   │   ├── content-models/        # status of all registered sources
│   │   ├── users/
│   │   ├── settings/
│   │   ├── account/
│   │   └── review/                # per-domain review queues
│   ├── api/
│   │   ├── auth/                  # login, register, verify, google, viewer
│   │   ├── health/
│   │   └── <domain>/              # public read APIs per content source
│   ├── login/
│   ├── register/
│   ├── forgot-password/
│   ├── reset-password/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── content/models.ts          # defineContentSource(...) + contentSources
│   ├── admin/nav.ts               # createAdminNav([...])
│   ├── admin/actions.ts           # server actions
│   ├── auth.config.ts             # AuthConfig
│   ├── site/config.ts             # site name, locales, brand
│   ├── pages/                     # generic page adapter (optional)
│   └── utils.ts
├── components/
│   ├── ui/                        # shadcn primitives, source-owned
│   ├── site/                      # site-wide components
│   ├── notion-blocks.tsx          # Notion block renderer
│   └── theme-*.tsx
├── migrations/
│   ├── 0001_init.sql              # auth + content_search_index
│   └── 0002_admin_seed.sql
├── worker/
│   └── index.ts                   # createNotionxWorker({...})
├── public/
├── tests/
│   └── smoke.test.ts
├── .notionx/
│   └── scaffold.json              # scaffold metadata used by update/repair
├── wrangler.jsonc                 # CF bindings, vars, cron, queue
├── vite.config.ts
├── next.config.ts
├── vitest.config.ts
├── tsconfig.json
├── .dev.vars.example              # template; copy to .dev.vars
├── .dev.vars                      # gitignored; local secrets
├── .github/dependabot.yml         # recommended: watches @notionx/core
└── package.json
```

## Seven dependency layers inside `@notionx/core`

Imports only go **downwards**. ESLint `import/no-restricted-paths` enforces this in CI.

| Level | Directory | Depends on | Notes |
|---|---|---|---|
| 0 | `util`, `types` | — | Pure helpers, zero internal deps |
| 1 | `i18n`, `hooks` | util, types | Client-side config |
| 2 | `platform`, `cache` | util, types | Runtime facades, cache primitives |
| 3 | `notion` | platform, cache | Notion client + generic helpers |
| 4 | `content` | notion | ContentSource framework |
| 5 | `auth` | content | D1 auth, session, role |
| 5.5 | `email`, `storage`, `media` | platform, cache | Cross-cutting services |
| 6 | `admin` | auth, content | Admin shell, sidebar, user mgmt |
| 7 | `worker` | admin and below | `createNotionxWorker` entry |

Forbidden upward imports: `notion` cannot reference `content` / `auth` / `admin` /
`worker`; `content` cannot reference `auth` / `admin` / `worker`; `auth` cannot
reference `admin` / `worker`; `admin` cannot reference `worker`.

## Public subpaths

`packages/notionx/package.json#exports` declares which subpaths consumers may
import. Anything else (including anything under `src/internal/`) is private.
When writing code, use the documented subpaths:

```ts
import { defineContentSource } from "@notionx/core/content";
import { createNotionxWorker } from "@notionx/core/worker";
import { createAdminNav } from "@notionx/core/admin";
import { runNotionxDoctor } from "@notionx/core/doctor";
```

Use `@notionx/core/package.json#exports` as the final list. Current exports also
include focused route/page helpers such as `@notionx/core/pages`,
`@notionx/core/auth/routes/viewer`, `@notionx/core/worker/routes/health`,
`@notionx/core/storage/routes`, and `@notionx/core/media/routes/notion-media`.

## Where the magic happens

If the user is debugging and asks "where is X implemented?", the answer is
almost always **inside `@notionx/core`**, not in the consumer. Common lookups:

| Symptom | Look in `@notionx/core/src/...` |
|---|---|
| Auth login/register/forgot/reset | `auth/auth.ts`, `auth/auth-pages/` |
| Session cookie / CSRF | `auth/session.ts`, `auth/user-session.ts` |
| Notion list/detail rendering | `notion/mappers.ts`, `notion/blocks.ts` |
| Webhook handler | `notion/routes/webhook.ts`, `notion/webhook.ts` |
| Cache keys / invalidation | `cache/cache-keys.ts`, `content/revalidate.ts` |
| Search index | `content/search-index.ts`, `content/search.ts` |
| Admin sidebar / layout | `admin/sidebar.tsx`, `admin/layout.tsx` |
| `notionx:doctor` | `doctor/doctor.ts`, `doctor/cli.ts` |
| Notion media proxy | `media/routes/notion-media.ts` |
| R2 / CDN routes | `storage/routes/files.ts`, `storage/routes/cdn.ts` |
| Worker entry | `worker/bootstrap.ts`, `worker/index.ts` |
| i18n messages | `i18n/messages.ts`, `i18n/config.ts` |
| Platform detection | `platform/current.ts`, `platform/selection.ts` |

Always read the package source before guessing at the consumer.

## Apps in the monorepo (notionx repo only)

`apps/moviebluebook` is the **reference business app** that consumes
`@notionx/core` from the workspace. It exists to:

- Be the canary for breaking changes (CI runs its `node:test` suite on every PR).
- Demonstrate "how to use the package" to readers.
- Provide realistic fixtures for snapshot tests inside the package.

It is **not** a template that consumers copy anymore — that is the scaffolder's
job. If the user is editing `apps/moviebluebook` directly, they are likely
either notionx maintainers or building the canary for a new feature.
