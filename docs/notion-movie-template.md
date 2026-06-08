# Notion Movie Source Setup

This project can use Notion as a movie CMS while Cloudflare handles public
traffic and D1 handles private membership.

## Architecture

```text
Notion data source
  -> vinext / Next.js routes
  -> Cloudflare Workers + ISR + media proxy
  -> public movie pages

D1 users.role
  -> protected download API
  -> VIP-only download links and extraction codes
```

Notion is the editing source, not the public high-traffic database. Public pages
are cached at the Cloudflare layer. Private download data is returned only from a
dynamic API after server-side auth.

## Required Notion Setup

1. Create a Notion internal integration.
2. Share the movie data source with that integration.
3. Set `NOTION_TOKEN`.
4. Set `NOTION_MOVIES_DATA_SOURCE_ID`.

## Movie Data Source Fields

Required:

- `电影名称` - title

Recommended:

- `上映时间` - date
- `导演` - rich text
- `演员` - rich text
- `剧情简介` - rich text
- `类型` - multi-select
- `海报` - files

VIP download fields:

- `下载链接` - URL
- `提取码` - rich text

Legacy fallback:

- `下载地址` - rich text URL

Page body media:

- Add Notion video, image, file, PDF, audio, embed, and rich text blocks inside
  each movie page. The public detail page renders supported blocks.

## Caching Strategy

- `/movies` is ISR-cached for 300 seconds.
- `/movies/:id` is ISR-cached for 300 seconds and contains only public data.
- `/api/movies` is a public JSON feed, cacheable for 300 seconds, and never
  includes private download URLs or extraction codes.
- `/api/movies/:id` is the public JSON detail feed. It can expose Notion body
  blocks, images, and videos, but not VIP download fields.
- Notion-hosted media blocks in public JSON use stable `/api/notion/media/...`
  URLs instead of expiring Notion signed URLs.
- `/api/movies/:id/download` is dynamic, `no-store`, and requires `vip` or
  `admin`.
- `/api/notion/media/...` gives Notion media stable app URLs and Cloudflare
  cache headers.

This keeps normal visitor traffic away from Notion most of the time. Notion API
calls mainly happen when cached pages regenerate, media signed URLs refresh, or
VIP users request private download data.

The movie data source intentionally queries normal Notion row properties by
field name instead of filtering by property IDs. This makes the template easier
for other workspaces to duplicate without copying Notion's internal property
IDs.

## Reusable Project Model

For other people deploying this project, the split should stay the same:

- Notion is the friendly CMS for editors.
- Cloudflare Workers and the Cache API serve public HTML and JSON.
- Cloudflare Images resizes Notion-hosted posters through `/api/notion/media`.
- D1 stores users, sessions, and VIP roles.
- Large production videos should move to R2, Cloudflare Stream, YouTube, Vimeo,
  or another CDN, with the playback URL stored in Notion.

## Membership

Users live in D1, not Notion.

- `role = 'user'` cannot view download data.
- `role = 'vip'` can view download data.
- `role = 'admin'` can view download data and manage users.

Admins can promote or demote VIP users from `/admin/users`.

## Media Guidance

Notion-hosted images work well through the media proxy. For large video files or
high traffic, prefer R2, Cloudflare Stream, YouTube, Vimeo, or a dedicated CDN
and store the public playback/download URL in Notion.

## Free Notion Compatibility

The template can work with a Free Notion workspace if the integration can access
the data source. Paid Notion plans are not required for the API itself, but Free
workspaces may hit product-level limits such as file upload size and workspace
collaboration limits.
