# Adding or modifying a content source

Scope: editing an existing notionx consumer project to add or change a
Notion-backed `defineContentSource(...)` module. For broader add/replace/remove
work, also read `domain-module.md`.

## Mental model

A content source bridges a Notion data source to a public/admin surface in a
notionx project. `defineContentSource` registers metadata so package features can
discover it, but the project still owns concrete pages, optional APIs, UI, docs,
and tests.

Current generated projects also include Notion-backed generic Pages via
`lib/pages/*`; the content-list page can read page title/SEO/nav settings from
that Pages model while listing entries from the content source.

## Add `podcasts`

### 1. Create or inspect Notion

Create a Notion data source with fields such as `Name`, `Slug`, `Description`,
`Published`, `Date`, `Tags`, `Cover`, `Hosts`, `Episode`. Record the data
source id. Do not print or commit `NOTION_TOKEN`.

### 2. Add the source in `lib/content/models.ts`

Append a source and register it in `contentSources`:

```ts
import {
  defineContentSource,
  type ContentSource,
} from "@notionx/core/content";

export const podcastSource: ContentSource = defineContentSource({
  id: "podcasts",
  kind: "catalog",
  visibility: { public: true, admin: true },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_PODCASTS_DATA_SOURCE_ID",
    fields: {
      title: "Name",
      slug: "Slug",
      description: "Description",
      published: "Published",
      date: "Date",
      tags: "Tags",
      cover: "Cover",
      hosts: "Hosts",
      episode: "Episode",
    },
    query: { pageSize: 50 },
  },
  routes: {
    listPath: "/podcasts",
    detailPath: "/podcasts/[slug]",
    detailParam: "slug",
    publicApiPath: "/api/podcasts",
  },
  ui: {
    name: "Podcast",
    pluralName: "Podcasts",
    navLabel: "Podcasts",
    listTitle: "Podcasts",
    listDescription: "Episodes maintained in Notion.",
    emptyState: "No podcast episodes published yet.",
  },
  capabilities: {
    richBlocks: true,
    coverImages: true,
    gatedAssets: false,
  },
});

export const contentSources = [blogSource, podcastSource] as const;
export type ContentSourceId = (typeof contentSources)[number]["id"];
```

Field key convention is camelCase TypeScript key -> Notion property name. Keep
keys stable when renaming Notion columns.

### 3. Wire worker sources

If `worker/index.ts` imports individual sources, add the new one:

```ts
const notionx = createNotionxWorker({
  sources: [blogSource, podcastSource],
  adminNav,
  authConfig,
  siteConfig: { /* current generated shape */ },
});
```

If the project already passes `contentSources`, no change is needed.

### 4. Add public pages

Generated list pages use `listGenericNotionContent` from `@notionx/core/notion`
and optional page chrome from `getSitePageForContentSource`:

```tsx
import { listGenericNotionContent } from "@notionx/core/notion";
import { podcastSource } from "@/lib/content/models";
import { getSitePageForContentSource } from "@/lib/pages/source";

export const revalidate = 300;

export default async function PodcastsPage() {
  const items = await listGenericNotionContent(podcastSource);
  const page = await getSitePageForContentSource("podcasts");
  // Render a domain-specific list UI.
}
```

For details, create `app/podcasts/[slug]/page.tsx`. Use package Notion helpers
for fetching/mapping when possible. Render blocks only if `richBlocks` is true,
and sanitize public fields before exposing data.

### 5. Add APIs only when needed

Public APIs are optional. If consumers need JSON, add:

```text
app/api/podcasts/route.ts
app/api/podcasts/[slug]/route.ts
```

Keep JSON shape aligned with page behavior and omit private Notion fields,
internal notes, gated URLs, admin-only flags, and raw tokens.

### 6. Optional admin page

Add `app/admin/podcasts/page.tsx` only if there is a real review/admin workflow.
Then register a nav item in `lib/admin/nav.ts` with `createAdminNav([...])`.

### 7. Env vars and docs

Add `NOTION_PODCASTS_DATA_SOURCE_ID` to:

- `.dev.vars` for local dev
- `wrangler.jsonc#vars` or production secrets strategy
- `.dev.vars.example`
- README or domain docs if the project has setup docs

### 8. Verify

```bash
pnpm notionx:doctor
pnpm test
pnpm build
pnpm dev
```

Open `/admin/content-models` and the public list/detail routes. Confirm source
registration, env names, field count, route paths, cache behavior, and UI.

## Modify an existing source

- Adding a field: append to `fields`, update page/API rendering, handle missing
  values.
- Renaming a Notion field: change only the value side, keep the TS key stable.
- Removing a field: remove usages first, then the field entry; update
  capabilities if it was cover/gated/block-related.
- Changing slugs/detail params: update routes, links, cache/revalidation tests,
  and any search index assumptions.

After changes, verify `/admin/content-models` and public routes before deploy.
