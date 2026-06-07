# Notion Blog Migration Implementation Plan

Updated for the current Notion API and this project's Cloudflare/vinext runtime.

## Goal

Migrate public blog content from D1 paragraph JSON to Notion-backed content while
keeping D1 for application and business data.

Notion becomes the single source of truth for:

- blog post metadata
- blog post body content
- cover images
- embedded images, videos, files, and external media references
- published/draft status

D1 remains the source of truth for:

- users and sessions
- subscribers
- auth and rate-limit state
- app settings
- future business data such as analytics, comments, bookmarks, or audit records

## Current Notion API Baseline

Use the official Notion JavaScript SDK, not deprecated database query flows.

- Package: `@notionhq/client`
- SDK version target: latest v5 line (`5.22.0` was current when this plan was
  written)
- API version: `2026-03-11`
- Query endpoint: `notion.dataSources.query({ data_source_id })`
- Page content endpoint: `notion.blocks.children.list`
- Pagination helpers: `collectPaginatedAPI` or `iteratePaginatedAPI`

The old `databases.query` naming should not be used for new code. In modern
Notion, a database is the container; its data source is the table-like object
whose pages can be queried. Use `NOTION_DATA_SOURCE_ID`, not
`NOTION_DATABASE_ID`, for the blog source.

References:

- https://developers.notion.com/docs/working-with-databases
- https://developers.notion.com/reference/query-a-data-source
- https://developers.notion.com/guides/data-apis/working-with-page-content
- https://developers.notion.com/reference/file-object
- https://developers.notion.com/reference/webhooks
- https://github.com/NotionX/react-notion-x
- https://github.com/transitive-bullshit/nextjs-notion-starter-kit

## Architecture Decision

Use the official Notion API for data access and a local renderer for the first
production version.

### Why Not Use `react-notion-x` As The Default

`react-notion-x` is mature and powers projects like
`nextjs-notion-starter-kit`. It is excellent when the goal is to reproduce a
full public Notion page with high visual fidelity.

This project has different constraints:

- content is coming from a private integration token, not necessarily public
  Notion pages
- the public blog already has its own chrome, cards, metadata, theme, and
  Cloudflare media pipeline
- Notion-hosted files have expiring URLs, so media should be routed through
  stable app URLs
- the site only needs a blog article renderer, not a full Notion workspace clone

So v1 should use:

- official `@notionhq/client` for list, page, and block data
- app-level mapper types for blog metadata
- a project-owned `NotionBlockRenderer` for body blocks
- stable media proxy routes for Notion-hosted images and videos

`react-notion-x` remains a valid future option for a dedicated "render exactly
like Notion" mode, but it should not shape the core data contract.

## Required Notion Data Source Schema

Create a Notion data source named something like `Blog Posts`.

Required properties:

- `Title` - title
- `Slug` - rich text
- `Description` - rich text
- `Date` - date
- `Author` - rich text or people
- `Tags` - multi-select
- `Status` - status, with `Published` as the public value

Optional properties:

- `Published` - checkbox. Supported as a simpler alternative to `Status`.
- `Cover` - files. If absent, the page cover is used.
- `Canonical URL` - url, for future redirects or external canonical links.
- `Summary` - rich text, if different from `Description`.

Publishing rule:

- A post is public when `Published` is checked or `Status` is `Published`
  case-insensitively.
- Missing slug, title, or date means the post is excluded from public lists.
- The body content lives in the Notion page children, not in a D1 field.

## Environment Variables

Add these to `env.d.ts`, `.dev.vars`, and Cloudflare secrets/config as needed:

```ts
interface VinextEnv extends Env {
  DB: D1Database;
  NOTION_TOKEN?: string;
  NOTION_DATA_SOURCE_ID?: string;
  NOTION_API_BASE_URL?: string;
  NOTION_EDIT_BASE_URL?: string;
  NOTION_WEBHOOK_VERIFICATION_TOKEN?: string;
}
```

Notes:

- `NOTION_TOKEN` must be a Notion integration token with access to the blog data
  source and its pages.
- `NOTION_DATA_SOURCE_ID` is the ID passed to `dataSources.query`.
- `NOTION_EDIT_BASE_URL` can point to the Notion data source view for admin
  handoff screens.
- `NOTION_WEBHOOK_VERIFICATION_TOKEN` is only needed when webhook invalidation
  is added.

## File Structure

### New Files

- `lib/notion/config.ts`
  - Reads and validates Notion environment configuration.
- `lib/notion/client.ts`
  - Creates the official Notion SDK client with `notionVersion: "2026-03-11"`.
- `lib/notion/types.ts`
  - Defines app-level blog models and supported block/media models.
- `lib/notion/mappers.ts`
  - Maps Notion page properties and file objects into app-level models.
- `lib/notion/posts.ts`
  - Public read API for blog list, slug list, and detail pages.
- `lib/notion/blocks.ts`
  - Fetches paginated page blocks recursively where needed.
- `lib/notion/media.ts`
  - Resolves page cover, file properties, image blocks, video blocks, and
    external media URLs.
- `lib/notion/mappers.test.mjs`
  - Unit tests for property mapping and publishing rules.
- `lib/notion/posts.test.mjs`
  - Unit tests for list filtering and slug resolution with stubbed Notion
    responses.
- `lib/notion/media.test.mjs`
  - Unit tests for stable media refs and external/Notion-hosted file handling.
- `components/NotionBlockRenderer.tsx`
  - Renders supported body blocks.
- `components/NotionRichText.tsx`
  - Renders Notion rich text annotations and links.
- `components/AdminNotionPostCard.tsx`
  - Admin handoff card with an "Open in Notion" action.
- `app/api/notion/media/[...ref]/route.ts`
  - Stable media URL resolver/proxy for Notion-hosted page covers and media
    blocks.
- `app/api/notion/revalidate/route.ts`
  - Optional webhook endpoint for cache invalidation.
- `docs/notion-blog-template.md`
  - Setup guide for the Notion data source, required fields, and media rules.

### Modified Files

- `package.json`
  - Add `@notionhq/client`.
  - Add Notion-focused tests to `npm test`.
- `env.d.ts`
  - Add Notion env bindings.
- `lib/env.ts`
  - Add Notion env fields to `AppEnv`.
- `app/blog/page.tsx`
  - Read published metadata from `lib/notion/posts`.
- `app/blog/[slug]/page.tsx`
  - Read Notion detail and render blocks through `NotionBlockRenderer`.
- `app/api/posts/route.ts`
  - Return Notion-backed public post metadata.
- `app/api/posts/[slug]/route.ts`
  - Return Notion-backed post detail JSON or a plain-text/body summary shape.
- `app/sitemap.ts`
  - Generate post URLs from Notion slugs.
- `app/api/health/route.ts`
  - Keep D1 health checks and optionally include Notion health as degraded-only.
- `components/PublicCoverImage.tsx`
  - Accept stable Notion media URLs without assuming `/api/cdn`.
- `lib/public-image.ts`
  - Treat `/api/notion/media/...` as a valid public image source. It should not
    generate Cloudflare Images `srcSet` in v1 unless a transform path is added.
- `app/admin/page.tsx`
  - Replace D1 article management with a read-only Notion-backed post index.
- `app/admin/new/page.tsx`
  - Replace local create form with Notion handoff.
- `app/admin/[slug]/edit/page.tsx`
  - Replace local edit form with Notion handoff.
- `lib/actions.ts`
  - Stop D1-backed create/update actions from being a valid blog content path.
- `components/NewPostForm.tsx`
  - Replace body editing UI with Notion handoff or stop rendering it.
- `components/EditPostForm.tsx`
  - Replace body editing UI with Notion handoff or stop rendering it.
- `lib/blog-detail-route.test.mjs`
  - Assert detail page uses `NotionBlockRenderer` instead of `post.content.map`.
- `lib/posts.admin.test.ts`
  - Assert admin new/edit pages no longer render D1-backed forms.

## Media Strategy

Notion file objects have two important modes:

- `external`: permanent public URL controlled by the content owner.
- `file`: Notion-hosted URL with `expiry_time`; the URL must be refreshed from
  Notion after it expires.

This means public HTML should not cache raw Notion-hosted signed URLs as stable
content. Instead, render stable app URLs and resolve them at request time.

### Stable Media URL Shapes

Use stable internal URLs:

- `/api/notion/media/page/:pageId/cover`
- `/api/notion/media/page/:pageId/property/:propertyName`
- `/api/notion/media/block/:blockId`

Implementation can use a catch-all route:

- `app/api/notion/media/[...ref]/route.ts`

### Media Route Behavior

For page cover:

1. Retrieve the page.
2. Read `page.cover`.
3. If cover is external, redirect to the external URL.
4. If cover is Notion-hosted, redirect to the fresh signed URL or stream it.
5. Return 404 if no cover exists.

For media blocks:

1. Retrieve the block by `blockId`.
2. Accept only `image`, `video`, `file`, `pdf`, or `audio` block types.
3. Resolve the block's file object.
4. Redirect or stream the underlying URL.

For file properties:

1. Retrieve the page.
2. Read the named files property.
3. Resolve the first file entry.
4. Redirect or stream the underlying URL.

V1 should use `302` redirects for simplicity. If hotlinking, auth, or content
headers become problematic, switch to streaming through the Worker.

### Image Rendering

Supported in v1:

- external images from stable public URLs
- Notion-hosted image blocks through `/api/notion/media/block/:blockId`
- Notion-hosted page covers through `/api/notion/media/page/:pageId/cover`
- captions
- lazy loading
- responsive CSS layout

Deferred:

- Cloudflare Images transformation for remote Notion media
- generated blur placeholders
- persistent R2 mirroring

### Video Rendering

Supported in v1:

- YouTube watch/embed URLs rendered as responsive iframes
- Vimeo URLs rendered as responsive iframes when straightforward to map
- direct external `.mp4`, `.webm`, `.mov`, `.m4v` rendered with
  `<video controls preload="metadata">`
- Notion-hosted video blocks via `/api/notion/media/block/:blockId`
- generic embed blocks as sandboxed iframes with an allow-list

Recommended content guidance:

- Use YouTube/Vimeo/external CDN URLs for durable video publishing.
- Avoid relying on large Notion-hosted videos for production traffic.

## Supported Block Renderer Scope

V1 block support:

- paragraph
- heading_1, heading_2, heading_3, heading_4
- bulleted_list_item
- numbered_list_item
- quote
- callout
- divider
- code
- image
- video
- embed
- bookmark
- file
- pdf
- audio
- table
- table_row
- to_do
- toggle
- column_list and column with simple responsive stacking
- unsupported fallback

V1 rich text support:

- bold
- italic
- underline
- strikethrough
- code
- links
- equations as plain fallback unless KaTeX is added
- color classes where simple and theme-safe

Do not aim to reproduce every Notion pixel. The renderer should produce stable,
readable article HTML that fits the existing vinext Blog design.

## Caching Strategy

Keep `revalidate = 300` on public blog routes.

Use three cache layers conceptually:

1. React/route cache for Notion list/detail fetches.
2. Cloudflare public HTML cache already configured in `next.config.ts`.
3. Short browser/CDN caching on `/api/notion/media/...` redirects.

Cache guidance:

- `/blog`: 5 minute revalidation
- `/blog/[slug]`: 5 minute revalidation
- `/api/posts`: 5 minute CDN cache
- `/api/posts/[slug]`: 1 minute to 5 minute CDN cache
- `/api/notion/media/...`: short cache, such as 5 minutes, because Notion file
  URLs expire

Webhook invalidation can be added after the first working migration. The webhook
should verify `X-Notion-Signature` using `verifyWebhookSignature` from
`@notionhq/client`, then invalidate `/blog` and affected slugs where possible.

## Admin Boundary

After migration, the internal admin UI must not remain a second blog editor.

V1 admin behavior:

- `/admin` shows a read-only Notion-backed post index.
- `/admin/new` links to the Notion data source.
- `/admin/[slug]/edit` links to the matching Notion page or data source.
- D1 create/update blog actions redirect with a clear "content moved to Notion"
  message.

Legacy review flows can be removed from the active blog path or left hidden until
deleted in a later cleanup. They should not control public publishing after the
Notion migration.

## Implementation Tasks

### Task 1: Dependency And Env Plumbing

Files:

- `package.json`
- `package-lock.json`
- `env.d.ts`
- `lib/env.ts`
- `lib/notion/config.ts`
- `lib/notion/client.ts`

Steps:

- [ ] Install `@notionhq/client`.
- [ ] Add Notion env vars to `env.d.ts` and `lib/env.ts`.
- [ ] Create `getNotionConfig()`.
- [ ] Create `createNotionClient()` with:

```ts
new Client({
  auth: config.token,
  baseUrl: config.apiBaseUrl,
  notionVersion: "2026-03-11",
});
```

- [ ] Run `npx tsc --noEmit`.

### Task 2: App-Level Types And Mappers

Files:

- `lib/notion/types.ts`
- `lib/notion/mappers.ts`
- `lib/notion/mappers.test.mjs`

Steps:

- [ ] Define `NotionPostListItem`.
- [ ] Define `NotionPostDetail`.
- [ ] Define narrow block/media types used by the renderer.
- [ ] Map title, slug, description, date, author, tags, status, and cover.
- [ ] Support both `Published` checkbox and `Status=Published`.
- [ ] Exclude invalid public rows.
- [ ] Add tests for fallback fields, published rules, cover mapping, and author
      variants.

### Task 3: Notion Read Source

Files:

- `lib/notion/posts.ts`
- `lib/notion/blocks.ts`
- `lib/notion/posts.test.mjs`

Steps:

- [ ] Implement `listPublishedNotionPosts()`.
- [ ] Use `dataSources.query` with filters and sorts.
- [ ] Use `filter_properties` to keep list responses lean.
- [ ] Implement `getNotionPostSlugs()`.
- [ ] Implement `getNotionPostBySlug(slug)`.
- [ ] Fetch page children recursively only for detail pages.
- [ ] Add stubbed tests for filtering, sorting, slug lookup, and missing rows.

### Task 4: Media Resolution

Files:

- `lib/notion/media.ts`
- `app/api/notion/media/[...ref]/route.ts`
- `lib/notion/media.test.mjs`
- `lib/public-image.ts`
- `lib/public-image.test.ts`

Steps:

- [ ] Implement helpers for Notion file objects.
- [ ] Generate stable media refs for page covers and media blocks.
- [ ] Add media route for page cover, file property, and block media.
- [ ] Return external media URLs directly or through redirects.
- [ ] Refresh Notion-hosted file URLs at request time.
- [ ] Add tests for external URLs, Notion-hosted URLs, unsupported media, and
      stable URL generation.

### Task 5: Block Renderer

Files:

- `components/NotionRichText.tsx`
- `components/NotionBlockRenderer.tsx`
- `app/globals.css`
- `lib/blog-detail-route.test.mjs`

Steps:

- [ ] Render basic text and headings.
- [ ] Render lists, quotes, callouts, dividers, code blocks, tables, toggles,
      and todos.
- [ ] Render images with captions.
- [ ] Render videos and embeds with responsive wrappers.
- [ ] Add safe fallback for unsupported blocks.
- [ ] Add focused CSS for article blocks without changing site-wide theme.
- [ ] Update route regression so detail pages no longer map `post.content`.

### Task 6: Public Routes And APIs

Files:

- `app/blog/page.tsx`
- `app/blog/[slug]/page.tsx`
- `app/api/posts/route.ts`
- `app/api/posts/[slug]/route.ts`
- `app/sitemap.ts`
- `app/api/health/route.ts`

Steps:

- [ ] Switch public blog list to Notion metadata.
- [ ] Switch detail page to Notion detail and block renderer.
- [ ] Update metadata and Open Graph fields.
- [ ] Update static params from Notion slugs.
- [ ] Update public JSON APIs.
- [ ] Update sitemap.
- [ ] Keep health checks from failing the whole app solely because Notion is
      temporarily unavailable, unless configured to require it.

### Task 7: Admin Handoff

Files:

- `components/AdminNotionPostCard.tsx`
- `app/admin/page.tsx`
- `app/admin/new/page.tsx`
- `app/admin/[slug]/edit/page.tsx`
- `components/NewPostForm.tsx`
- `components/EditPostForm.tsx`
- `lib/actions.ts`
- `lib/posts.admin.test.ts`

Steps:

- [ ] Make `/admin` a read-only Notion-backed post index.
- [ ] Make `/admin/new` open Notion instead of rendering `NewPostFormLazy`.
- [ ] Make `/admin/[slug]/edit` open the matching Notion page or data source.
- [ ] Stop D1 create/update actions from writing blog content.
- [ ] Add regression tests that D1-backed forms are no longer on the active
      admin create/edit path.

### Task 8: Optional Webhook Invalidation

Files:

- `app/api/notion/revalidate/route.ts`
- `lib/notion/webhook.ts`
- `lib/notion/webhook.test.mjs`

Steps:

- [ ] Add webhook verification with `verifyWebhookSignature`.
- [ ] Accept Notion verification handshake.
- [ ] Parse page/content update events.
- [ ] Revalidate `/blog`.
- [ ] Revalidate affected slug when the event includes enough page context.
- [ ] Fall back to time-based revalidation when the changed slug cannot be
      resolved cheaply.

### Task 9: Setup Docs And Regression Sweep

Files:

- `docs/notion-blog-template.md`
- `package.json`

Steps:

- [ ] Document required Notion data source fields.
- [ ] Document recommended image/video publishing practices.
- [ ] Document env vars for local and Cloudflare deployment.
- [ ] Update `npm test` with Notion-focused tests.
- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.

## Migration Safety Checklist

- [ ] Public blog pages no longer import `@/lib/posts`.
- [ ] Public post APIs no longer import `@/lib/posts`.
- [ ] Sitemap no longer imports `@/lib/posts`.
- [ ] Admin create/edit pages no longer render D1-backed forms.
- [ ] Notion-hosted media is never embedded as a long-lived raw signed URL in
      generated HTML.
- [ ] Missing Notion optional fields do not crash the public routes.
- [ ] Unsupported block types degrade gracefully.
- [ ] D1 schema and user/subscriber flows remain untouched.

## Notes For Future Improvements

- Add R2 mirroring for Notion-hosted images if traffic grows.
- Add Cloudflare Images transforms for media proxy responses.
- Add generated Open Graph images from Notion metadata.
- Add full text search using a separate index rather than querying Notion on
  every search request.
- Remove legacy D1 post tables only after a separate data-retention decision.
