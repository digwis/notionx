# Domain module convention

Use this when adding, replacing, or removing a Notion-backed content source such
as books, courses, tools, portfolios, directories, movies, or another catalog.
Here "domain" means content/business module, not DNS domain.

## Core rule

Build domains as source code. Notion owns the content model and editorial data;
the project owns mapping, routes, public API shape, UI, tests, and docs.

Do not introduce JSON blueprint generators, `blueprints/`, generated registries,
runtime theme/plugin marketplaces, broad content templates, or layout config in
`ContentSource` for ordinary customization. Extract small helpers only after two
real domains prove the same shape.

## Files to inspect

Before editing, inspect the current project first:

- `lib/content/models.ts`
- `worker/index.ts`
- `lib/pages/*` when the project uses Notion-backed generic pages
- Existing `app/<domain>` and `app/api/<domain>` routes
- Existing `components/<domain>` or `components/<Domain>*`
- `lib/admin/nav.ts` and any `app/admin/<domain>` pages
- `wrangler.jsonc`, `.dev.vars.example`, docs, tests, sitemap/nav references

In older copied vinext projects, also check `lib/notion/posts.ts`,
`lib/notion/movies.ts`, `lib/notion/property-mappers.ts`,
`docs/notion-blog-template.md`, and `docs/notion-movie-template.md` when present.

## Add a domain

Create or update these as needed:

```text
lib/content/models.ts
  Add <domain>Source with Notion fields, routes, UI labels, capabilities.
  Append it to contentSources.

worker/index.ts
  Include the source in createNotionxWorker({ sources: [...] }) if needed.

app/<domain>/page.tsx
  Public list/search page, usually using @notionx/core/notion helpers.

app/<domain>/[slug]/page.tsx
  Public detail page, with Notion blocks only when capabilities.richBlocks applies.

app/api/<domain>/route.ts and app/api/<domain>/[slug]/route.ts
  Public APIs only when callers need them; strip private/gated fields.

components/<domain>/* or components/<Domain>*.tsx
  Domain-specific UI built with React, Tailwind, shadcn/ui, lucide icons.

app/admin/<domain>/page.tsx and lib/admin/nav.ts
  Optional domain admin/review surface.

docs or README/env examples
  Notion field checklist, publishing rules, media guidance.

tests
  Mapper, visibility/filtering, privacy, route, cache/revalidation behavior.
```

## ContentSource shape

Keep `defineContentSource` about source/runtime metadata:

- `id`: stable plural id, such as `books`.
- `kind`: current allowed values are `article`, `catalog`, `directory`.
- `visibility`: public/admin exposure.
- `source`: Notion token env, data source env, optional default data source id,
  fields, query `pageSize`, sorts, filterProperties.
- `routes`: list/detail/API paths and detail param.
- `ui`: display labels and empty-state copy.
- `capabilities`: rich blocks, cover images, gated assets.

Do not add template names, theme presets, layout options, or JSON UI config to
the model.

## Notion boundary

Let Notion own:

- database/data source properties
- editorial status and publish flags
- tags, categories, people, relations, ratings, dates, and media fields
- manual and AI-assisted bulk edits

Let code own:

- how Notion fields map to public data
- public/private field sanitization
- list/detail/API shape
- search, sort, and filter UX
- Tailwind/shadcn layout and interactions

## Search, sort, filter

- Prefer Notion query sorts for canonical ordering such as date, rating, or
  release time.
- Use URL query params for public filters such as tag, genre, status, author,
  category, year, difficulty, or rating.
- Keep page behavior and API behavior aligned.
- Add tests for multi-term matching and field-specific filters.

## Replacing or removing a domain

Remove old domain-owned routes, API routes, model registration, source imports,
components, tests, docs, env references, navigation, sitemap links,
cache/webhook assumptions, and migrations only when they belong to that domain.
Preserve foundation files, scaffold-owned files, and unrelated user work.

After replacement, verify:

- `contentSources` and `worker/index.ts` include only intended sources.
- `/admin/content-models` shows the new source and no removed source.
- Public APIs do not leak private Notion fields or gated asset URLs.
- Notion media uses stable package media routes where needed.
- Search/filter behavior matches the public page and API.
- Env examples and docs match required Notion fields.
- `pnpm test`, `pnpm build`, and `pnpm notionx:doctor` pass when local config is present.
