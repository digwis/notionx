---
"@notionx/create-notionx-app": patch
---

Fix scaffolded project build/type errors

- Correct `defineLocaleContract` re-export path
- Import `NotionPageLike` from `@notionx/core/notion`
- Infer `SitePageBlockRef` from `BaseSitePage` instead of importing an unexported type
- Add `DB` to `RequestEnv` and wrap the D1 binding in `SqlDatabaseAdapter`
- Require `modelId` in `RawNavItem` to match `SiteConfig`
