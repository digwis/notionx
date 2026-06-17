---
"@notionx/core": major
"@notionx/create-notionx-app": major
---

Notion schema overhaul: maximize Notion-native features for simpler editing

Breaking change: only applies to newly scaffolded projects. Existing
projects are not migrated — the Notion database schema changes are
incompatible with prior versions.

## Translation body → Notion page body

Translation tables no longer carry a `Body` rich_text field. Translation
content lives in the translation page's children blocks (page body),
removing the 2000-character rich_text limit. Writers edit translations
as normal Notion pages with full block editing.

## Site Settings → multi-row key-value design

Site Settings database redesigned from a single 17-field row to a
multi-row key-value layout grouped by Section. Each row is one setting
(Name/Section/Key/Value/Type/Published). Users add settings by adding
rows, not by adding fields — much more intuitive for non-developers.

## Blocks → minimal 6-field schema + page body

Blocks database simplified from 25 fields to 6 (Name/Slug/Type/Order/
Cover/Published). All block content (headings, paragraphs, callouts,
lists) lives in the block page's body as native Notion blocks, rendered
verbatim via `NotionBlocks`. Writers see exactly what readers get.

## Page → Block Notion relation with native sort order

Pages database `Blocks` field changed from a rich_text JSON array to a
Notion relation pointing to the Blocks database. The relation array
order (set by drag-and-drop in Notion) is the native sort order for
page blocks — no more manual `order` field or JSON editing.

New API: `getGenericNotionContentByIdForLocale` resolves a content item
by its base page ID (used by the Page → Block relation).

## Provision order: blocks before pages

The scaffolder now provisions the Blocks database before the Pages
database, so the Pages `Blocks` relation schema can point to the Blocks
database and seed pages can link to seed block pages via the relation.

## registry.json stores baseDatabaseIds

`registry.json` now persists `baseDatabaseIds` (database_id, not
data_source_id) for each base database. `notionx locale add` reads
these to auto-link translation Source relations to the correct base
database via `single_property` + `database_id`.
