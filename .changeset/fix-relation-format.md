---
"@notionx/cli": patch
---

Fix relation property format for Notion data sources API

The Notion data sources API (2025-09-03+) expects `data_source_id` directly
on the `relation` object, not nested inside `single_property`. Changed:
- `{ relation: { single_property: { data_source_id: "..." } } }` → `{ relation: { data_source_id: "..." } }`
- `{ relation: { database_property: {} } }` → `{ relation: {} }` (fallback)
