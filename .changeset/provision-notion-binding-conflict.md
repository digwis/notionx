---
"@notionx/create-nextion-app": patch
---

Avoid writing Notion data source ids as Worker secrets during provision so
re-provisioned projects do not fail when the ids are already bound via
`wrangler.jsonc` vars.
