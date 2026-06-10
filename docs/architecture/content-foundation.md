# vinext Content Foundation

> **此文档已不再作为权威来源。** 它描述的是 Foundation 包拆分**之前**的
> 内容基础结构。新的架构文档已经迁移到
> [`foundation-package.md`](./foundation-package.md)。位于 `apps/moviebluebook/`
> 的 starter 应用同时遵循两份文档：本文件（针对其内容域），以及新文档
> （针对 starter 与 package 之间的边界）。

This project is a Notion-powered copy starter for vinext on Cloudflare Workers.
It intentionally keeps the base small: platform adapters, auth, storage,
Notion helpers, media proxying, cache invalidation, reusable search helpers, and
editable React UI.

## Direction

- New projects may start by directly copying the starter.
- Notion is the editor-facing content source and content-modeling backend.
- AI and project code define, replace, or remove each content domain directly.
- vinext serves the application on Cloudflare Workers.
- D1 stores users, sessions, settings, auth rate limits, and gated-role data.
- R2 stores uploaded app assets and persistent media cache objects.
- Cloudflare Images transforms Notion and R2 media for public routes.
- shadcn/ui remains editable component source, not a runtime JSON page builder.

## Layers

```text
app/
  Concrete routes for the current project, such as blog and movies

lib/content/
  Current content source registry: Notion fields, routes, capabilities

lib/notion/
  Notion client, config, mappers, block traversal, media helpers, webhooks

lib/platform/
  Cloudflare runtime contracts and binding-backed adapters

lib/site/
  Site-level configuration: navigation and runtime defaults
```

## Content Sources

Each registered source declares:

- `source`: Notion token env, data source env, field mapping, query defaults.
- `routes`: public list/detail paths and optional API path.
- `ui`: labels, titles, descriptions, and empty state copy.
- `capabilities`: rich blocks, cover images, gated assets.

The current registered sources are:

- `blog`: article list/detail pages backed by `NOTION_DATA_SOURCE_ID`.
- `movies`: catalog list/detail pages backed by
  `NOTION_MOVIES_DATA_SOURCE_ID`.

New domains should be added as normal code: inspect or create the Notion data
source with Notion tooling, register a model in `lib/content/models.ts`, then
write the route, API, and UI that the project actually needs.

For copied projects, replacing a domain means deleting the old domain-owned
routes, APIs, mappers, components, docs, tests, env references, sitemap entries,
and cache/webhook assumptions while preserving the foundation.

## UI Boundary

The base does not ship a preset UI system. shadcn/ui is used for editable
components and primitives, while domain-specific screens remain React/Tailwind
source code. This makes the project easier for AI to customize without forcing
every future domain through a generic template.

Search, sorting, and filtering should be generic where possible and adapted per
domain where fields differ. Prefer Notion query sorts for canonical ordering and
app-side query params for public search/filter UX.

## Runtime Boundary

The active runtime facade is Cloudflare-only:

- `lib/platform/runtime.ts`: platform contracts and Cloudflare adapter factory.
- `lib/platform/cloudflare-runtime.ts`: binding-backed runtime instance.
- `lib/platform/current.ts`: project-facing facade used by app/business code.
- `lib/platform/capabilities.ts`: single active adapter definition.

Business code should import `lib/platform/current.ts` instead of reading
Cloudflare bindings directly.

The active services are:

- `database`: D1 through a D1-style prepared statement contract.
- `objectStorage`: R2 for uploads, `/api/files`, `/api/cdn`, and Notion media
  cache.
- `imageTransformer`: Cloudflare Images for media optimization.
- `publicCache`: Cloudflare `caches.default` for transformed Notion media cache
  reads/writes/deletes.
- Page and route caching: vinext CDN/data adapters configured in `vite.config.ts`.

## Revalidation

`revalidateContentModel(...)` calls `revalidatePath(...)` for each registered
public list path, detail path, and optional public API path declared on the
model. Vinext's CDN adapter handles edge purge from those path invalidations.

`POST /api/content/revalidate` exposes that boundary for automation. It requires
`Authorization: Bearer <NOTION_WEBHOOK_VERIFICATION_TOKEN>` and accepts:

```json
{
  "modelId": "blog",
  "routeId": "hello-world",
  "previousRouteId": "old-slug",
  "kind": "update",
  "includeApi": true
}
```

`POST /api/notion/webhook` is the Notion-facing endpoint. It handles the Notion
verification handshake, stores Notion's one-time `verification_token` in
`CONTENT_CACHE` KV when available, validates `X-Notion-Signature`, maps data
source/page events to registered content sources, and calls the same
revalidation path. Revalidation deletes public HTML/API cache, Notion content
KV, and affected search-index rows so Notion changes become visible as soon as
the webhook event is delivered.

## Foundation Doctor

`npm run foundation:doctor` summarizes the Cloudflare foundation:

- Cloudflare runtime and adapter status.
- D1, R2, Images, cache, and observability setup.
- Notion token and webhook verification configuration.
- Registered content source routes and data source env names.
- Next steps for missing required config.

The command is intentionally non-mutating and does not connect to Notion or
Cloudflare. It reads local config and environment state, then prints only
variable names and status. Use `--json` for CI or automation.

The admin route `/admin/content-models` mirrors the registered content sources
for humans. It shows route paths, Notion env names, field counts, and
capabilities, but it remains read-only.
