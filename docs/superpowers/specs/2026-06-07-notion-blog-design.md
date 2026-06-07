# Notion Blog Integration Design

## Summary

This design moves blog content ownership from `D1` to `Notion` while preserving `D1` for business data. The first version migrates only the public blog experience:

- `Notion` becomes the single source of truth for blog metadata and body content.
- `D1` continues to store business data such as users, authentication state, subscribers, settings, and future engagement metrics.
- The project renders Notion content inside the existing blog routes and layouts.
- The first version uses direct Notion-hosted media URLs and project-side page caching.

The goal is to simplify content editing, avoid dual-write conflicts, and keep the existing app architecture stable.

## Goals

- Use `Notion` as the only source for blog posts.
- Keep `D1` focused on application and business data.
- Preserve the existing `/blog` and `/blog/[slug]` route structure.
- Reuse as much of the current blog list and detail UI as practical.
- Add caching so the site does not depend on a fresh Notion request for every page view.
- Avoid maintaining the same article content in both `Notion` and `D1`.

## Non-Goals

- Migrating non-blog content such as home page modules, FAQ, or About pages.
- Keeping the current admin post editor as a second content editing path.
- Syncing Notion content into `D1`.
- Adding a media proxy, image optimization pipeline, or video transcoding in v1.
- Building webhook-driven instant invalidation in v1.
- Supporting every uncommon Notion block with custom polish in v1.

## Current State

The current blog implementation stores blog metadata and body content in `D1`. The `content` field is modeled as a JSON array of paragraph strings and rendered as simple paragraphs in the public detail page. This model works for plain text but is too limited for rich Notion content such as headings, callouts, embeds, code blocks, and nested structures.

The app already has stable public blog routes, metadata generation, card-based blog index UI, and ISR-style caching. These are assets worth preserving during the migration.

## Proposed Architecture

### Source Of Truth

- `Notion` stores:
  - title
  - slug
  - description
  - publication date
  - author
  - tags
  - cover image
  - published status
  - body content blocks
- `D1` stores:
  - users
  - authentication data
  - subscriber records
  - settings
  - audit and business records
  - future engagement data such as views, likes, bookmarks, or comments

### Rendering Model

- `/blog` reads published post metadata from a Notion database.
- `/blog/[slug]` resolves the matching Notion page and renders its body content.
- The application transforms Notion API responses into app-level models before rendering.
- The application caches rendered list/detail data using the same general revalidation approach already used by the blog routes.

### Ownership Rules

- Anything a reader perceives as article content belongs to `Notion`.
- Anything required for application behavior, business rules, or user data belongs to `D1`.
- No dual-write flow is allowed for blog content.
- The admin app must not continue to edit blog bodies after this migration.

## Notion Content Model

The first version uses one Notion database for blog posts.

### Required Fields

- `Title`
- `Slug`
- `Description`
- `Date`
- `Author`
- `Tags`
- `Cover`
- `Published` or `Status`

### Body Content

Each database row represents a single blog post. The body content lives in the corresponding Notion page rather than in structured fields. This keeps Notion as the native editing surface and avoids flattening rich content into custom JSON.

### Publishing Rule

Publishing is managed in `Notion`, not in `D1`. The app only renders posts marked as published. Unpublished posts do not appear in the index and resolve as not found from public routes.

## Application Design

### Data Access Layer

Add a dedicated `lib/notion/` module group. This layer owns all Notion-specific behavior:

- querying the blog database
- resolving a post by `slug`
- fetching the page block content for a post
- mapping Notion properties to app-level fields
- applying fallback logic for missing optional fields

This prevents Notion response shapes from leaking into route files and UI components.

### App-Level Models

Define explicit internal models for rendering:

- `NotionPostListItem`
- `NotionPostDetail`

These models should contain only the fields the app needs. The detail model includes the rendered-content source structure, while the list model contains lightweight metadata only.

### Routing

- `/blog`
  - fetch published post metadata from Notion
  - sort by date descending
  - render with the existing blog card UI
- `/blog/[slug]`
  - resolve a published page by slug
  - fetch body content blocks
  - render using a Notion renderer inside the existing article shell
- `generateMetadata`
  - derive `title`, `description`, and `openGraph` values from Notion metadata
- `generateStaticParams`
  - prebuild currently published slugs using the Notion source

### Rendering Components

Add a focused content renderer component, such as `NotionPostRenderer`, to encapsulate rich-body rendering. The public page remains responsible for layout, header, navigation, tags, cover image, and surrounding page chrome. The renderer is only responsible for the article body content.

The list page should keep the current cards and cover presentation so the migration does not trigger an unnecessary design rewrite.

## Caching Strategy

Version one uses project-side cache and revalidation instead of syncing content into `D1`.

### Cache Rules

- Blog index cache: short-lived revalidation, such as 5 minutes
- Blog detail cache: short-lived revalidation, such as 5 minutes

### Rationale

- Notion remains the content source of truth.
- The site avoids making a fresh request to Notion for every visitor request.
- Content changes become visible reasonably quickly without a full sync pipeline.
- The approach matches the existing app's public-route caching style.

### Deferred Enhancements

These are intentionally excluded from v1:

- manual invalidation endpoint
- Notion webhook integration
- article-level custom cache tags
- persistent server-side cache outside the existing route revalidation model

## Media Strategy

### Images

Version one renders images using the URLs returned by Notion. The app is responsible for layout and fallback handling, but not for proxying or re-hosting media.

This is the fastest path to a working integration. It trades some control for speed and simplicity.

### Video

Version one supports:

- embed-based video blocks
- direct playback for Notion-hosted file videos when the renderer supports them

It does not include:

- custom player work
- video proxying
- transcoding
- CDN remapping

### Cover Images

Cover images come from the Notion database metadata and reuse the current card/detail presentation components where possible.

## Error Handling And Fallbacks

### Missing Or Invalid Slug

- return `notFound()` when the slug does not map to a published Notion post

### Missing Optional Metadata

- missing cover image: use the existing visual placeholder
- missing tags: omit the tag section
- missing description: fall back to a safe derived description for metadata and previews

### Notion Availability Issues

- list page: show a degraded empty/error state instead of crashing the whole page
- detail page: fail with a controlled error boundary path or equivalent safe fallback

### Unsupported Blocks

If a block type is not fully supported by the chosen renderer configuration, the app should degrade gracefully rather than break the page layout.

## Admin Experience Changes

The existing admin post editor should not remain a second editing source for blog bodies.

### v1 Admin Changes

- remove or disable blog-body editing in the admin UI
- keep a lightweight read-only blog index in the admin UI
- provide a clear "Edit in Notion" entry point for blog content management

### Rationale

Maintaining both a Notion editor and an internal blog editor would create conflicting sources of truth. Preventing dual editing is a hard requirement for keeping the migration understandable and maintainable.

## Testing Strategy

### Unit Tests

- Notion property mapping
- published/unpublished filtering
- slug resolution
- metadata fallback behavior

### Route-Level Validation

- `/blog` renders published posts
- `/blog/[slug]` renders a valid post body
- missing slug returns 404
- missing optional fields do not crash rendering

### Regression Focus

- login and auth flows remain unaffected
- subscriber flows remain unaffected
- admin business pages remain unaffected
- theme behavior and existing blog chrome remain intact

## Risks And Mitigations

### Notion Response Latency

Mitigation:

- use route-level revalidation and avoid uncached per-request fetches

### Notion Media URL Stability

Mitigation:

- accept the trade-off in v1
- design the media access path so a future proxy layer can be inserted without changing page contracts

### Complex Notion Response Shapes

Mitigation:

- isolate Notion code in a dedicated data-access layer
- map external response data into narrow app-level models

### Content/Admin Boundary Confusion

Mitigation:

- explicitly remove admin-side body editing for blog posts in v1

## Version One Scope

### In Scope

- Notion-backed blog metadata source
- Notion-backed blog detail rendering
- existing `/blog` and `/blog/[slug]` route migration
- project-side cache/revalidation
- basic image and video rendering
- admin transition to "Edit in Notion"

### Out Of Scope

- non-blog page migration
- content sync into `D1`
- webhook-driven refresh
- custom media proxy
- analytics/engagement features
- full-site search over Notion content

## Implementation Boundaries

This design is intentionally scoped to a single migration track: public blog content only. If future work expands Notion ownership to other sections of the site, that should happen in separate follow-up specs so the blog migration stays focused and shippable.

## Recommendation

Adopt `Notion` as the single source of truth for blog content, preserve `D1` for business data, and implement the first version using project-side rendering plus short-lived route revalidation. This achieves the content-model goal with the least disruption to the current app architecture.
