---
"@notionx/create-nextion-app": minor
---

Add working defaults for the first content source and admin auth.

- Scaffold `app/<contentSourceListPath>/page.tsx` and `app/<contentSourceListPath>/[slug]/page.tsx` so the public list and detail pages exist out of the box. Reads from `@notionx/core/notion` `listGenericNotionContent` / `getGenericNotionContentBySlug` and renders cover image, title, description, date, and tags.
- Add `components/notion-blocks.tsx` with a small Notion block renderer covering paragraphs, headings, lists, quotes, callouts, code, images, video, embeds, bookmarks, files, toggles, and dividers. Unsupported blocks are skipped so a single rich-block oddity does not break the article.
- Wire `emailLoginAction` in the scaffolded `app/login/page.tsx` to the real `@notionx/core/auth` server-side helpers: `authenticateEmailUser`, `setUserSessionCookie`, `userToSession`, plus `enforceAuthRateLimits` / `recordAuthFailures` / `clearAuthRateLimits` and `getClientIp`. Login now sets the HMAC-signed session cookie and redirects to `/admin` on success; on failure it surfaces a localised error and records the attempt.
- Add a self-service `app/register/page.tsx` that calls `createEmailUser` and `validatePasswordStrength`, then redirects to `/login?registered=1`. Email delivery and verification are still the consumer's responsibility (see the package's `auth/email` and `/api/auth/verify-email` flows).
- Update `next.config.ts` to allow `next/image` to load covers from the Notion file CDN (`prod-files-secure.s3.us-west-2.amazonaws.com`, `www.notion.so`, `images.unsplash.com`).
- `render.ts` now also renders directory names so `app/{{contentSourceListPath}}/` resolves to `app/blog/` (or whatever id the consumer picked) at scaffold time.
