---
"@notionx/core": minor
"@notionx/create-nextion-app": minor
---

Add `npx nextion locale add <locale>` with a safe local-only default pass and an opt-in `--with-notion` flag that provisions the four built-in translation data sources (`blog-translations`, `page-translations`, `block-translations`, `site-settings-translations`). The command refuses to remove existing locales, never contacts Notion on the local pass, and surfaces missing translation sources in the doctor. `nextion update` now repairs translation-source secrets the same way it repairs Notion content-source secrets.
