---
"@notionx/cli": minor
---

Organize scaffolded Notion databases under flat category pages

Instead of placing all databases directly on the user-selected parent page,
the scaffolder now creates top-level category pages (`Blog`, `Pages`,
`Blocks`, `Site Settings`) as direct children of the parent page. Each base
database and its translations are created under the matching category page,
making the resulting Notion workspace easier to navigate.

- Added `ensureNotionPage` helper to find or create category pages by title.
- `provisionNotionContentAndPages` returns `categoryPageIds` for downstream
  translation and site-settings provisioning.
- Translation databases are created under the same category page as their
  base data source.
- The list-page URL now derives from the content source title (slugified),
  falling back to the content source id. Changing the title from `Blog` to
  `Articles` will therefore change the list-page URL from `/blog` to
  `/articles`.
- Scaffolded database titles no longer include the project name prefix
  (`Project Blog`, `Project Pages`, etc. are now `Blog`, `Pages`, etc.).
