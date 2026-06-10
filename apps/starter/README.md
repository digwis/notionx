# vinext Notion Content Foundation

This project is a low-cost, Notion-powered copy starter built primarily for
vinext on Cloudflare Workers, D1, R2, Cloudflare Images, and shadcn/ui. It keeps
the app layer familiar to Next/App Router developers where practical, but the
product direction is one vinext-first Cloudflare foundation, not a multi-runtime
starter.

> This repository is part of a pnpm workspace. The reusable platform lives in
> `packages/foundation/` and is published as `@vinext/foundation`. Changes to
> that package are released via changesets; everything in `apps/starter/` is
> project-local. See `docs/architecture/foundation-package.md` for the
> boundary and tier rules.

## Architecture

- Notion is the editor-friendly CMS and content modeling surface.
- `lib/content` registers the current Notion-backed content sources, fields,
  routes, and runtime capabilities.
- Cloudflare Workers serve the app; vinext CDN/data cache adapters handle public
  page and route caching at the edge.
- Cloudflare Images transforms Notion-hosted posters through `/api/notion/media`.
- D1 stores users, sessions, app settings, and VIP roles.
- R2 is available for uploaded app assets.
- Public content mutations call `revalidatePath(...)` so vinext can purge CDN
  cache entries for registered routes.
- VIP download links stay behind `/api/movies/:id/download` and are never cached.
- The runtime facade is Cloudflare-only: Workers for compute, D1 for SQL, R2
  for object storage, Cloudflare Images for media transforms, and
  `caches.default` for transformed Notion media caching.

## Notion Fields

Movie data source:

- `电影名称` - title
- `上映时间` - date
- `导演` - rich text
- `演员` - rich text
- `剧情简介` - rich text
- `类型` - multi-select
- `海报` - files
- `播放链接` - files or page video blocks
- `下载链接` - URL, VIP only
- `提取码` - rich text, VIP only

Blog data source:

- `Title`, `Slug`, `Description`, `Date`, `Author`, `Tags`
- `Status = Published` or `Published = true`
- optional `Cover`

See `docs/notion-movie-template.md` and `docs/notion-blog-template.md` for the
full setup notes.

See `docs/architecture/content-foundation.md` for the reusable foundation
direction and adapter boundaries.

## Environment

Set Cloudflare bindings in `wrangler.jsonc`, then set secrets with Wrangler:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put NOTION_TOKEN
```

Optional secrets and variables:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Common public vars:

- `NOTION_MOVIES_DATA_SOURCE_ID`
- `NOTION_DATA_SOURCE_ID`
- `NOTION_EDIT_BASE_URL`
- `SITE_URL`
- `RESEND_FROM`
- `GOOGLE_CLIENT_ID`
- `TURNSTILE_SITE_KEY`

## Development

```bash
npm install
npm run dev:vinext
```

## Custom Content And UI

The intended workflow is to copy this starter, then let AI add, replace, or
remove domain modules as code. Notion owns the content model and editing surface;
the app owns presentation, public/private field mapping, search/filter UX, and
domain-specific UI.

The project intentionally does not include a JSON blueprint or UI preset layer.
For a new domain, use Notion or a Notion CLI to inspect/create the data source,
then let AI add the matching model, routes, API, tests, and
React/Tailwind/shadcn UI as normal source code.

The reusable foundation is the platform underneath that custom work:

- Cloudflare Workers deployment through vinext.
- D1-backed auth, sessions, settings, roles, and app data.
- R2 uploads and stable Notion media proxy routes.
- Notion token/config helpers, block rendering, media handling, and webhook
  parsing.
- Public cache invalidation utilities for registered content routes.
- Reusable search/sort/filter helpers that can be adapted to each Notion domain.
- Shared shadcn/ui primitives that can be edited per project.

The currently registered content sources are visible in the admin UI at:

```text
/admin/content-models
```

That page is read-only. It displays model routes, Notion env names, field counts,
and capabilities. It is a status view, not a low-code content builder.

## Foundation Doctor

Run the foundation doctor after changing runtime settings, Notion models, or
deployment targets:

```bash
npm run foundation:doctor
npm run foundation:doctor -- --json
```

The doctor checks Cloudflare bindings, required Notion environment variables,
registered content models, and known setup gaps. It reads `wrangler.jsonc`,
`.dev.vars`, `.env.local`, and the current process environment, but only prints
variable names and status, never secret values.

## Test And Build

```bash
npm test
npm run build:vinext
```

## Deploy

```bash
npm run deploy:remote
```

This applies D1 migrations, deploys the Worker, and checks the remote schema.
