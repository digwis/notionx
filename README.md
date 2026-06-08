# vinext Notion Movie CMS

This project is a low-cost content site built with vinext, Next.js App Router,
Cloudflare Workers, D1, R2, Cloudflare Images, and Notion.

## Architecture

- Notion is the editor-friendly CMS for posts and movies.
- Cloudflare Workers serve the app and cache public HTML/JSON at the edge.
- Cloudflare Images transforms Notion-hosted posters through `/api/notion/media`.
- D1 stores users, sessions, app settings, and VIP roles.
- R2 is available for uploaded app assets.
- VIP download links stay behind `/api/movies/:id/download` and are never cached.

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
