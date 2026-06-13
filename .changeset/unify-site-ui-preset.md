---
"@notionx/create-nextion-app": patch
---

The CLI no longer asks which UI preset to bundle. All scaffolds now
ship the `site` preset (the Notion page builder set). The `--ui` /
`--ui-preset` flags and the `CREATE_NEXTION_UI[_PRESET]` env vars are
removed. The `minimal` and `app` presets are no longer reachable
through the scaffolder — the `site` set already covers the public-site
case the scaffolder targets. If you need a leaner set, run
`pnpm dlx shadcn add` for the components you actually need.
