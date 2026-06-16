---
"@notionx/core": major
"@notionx/create-notionx-app": major
"create-notionx": major
---

Rename: nextion → notionx (unified branding)

Breaking change: all user-visible `nextion` references renamed to `notionx`.

- npm packages: `@notionx/create-nextion-app` → `@notionx/create-notionx-app`
- shim package: `create-nextion-app` → `create-notionx`
- CLI command: `nextion` → `notionx` (e.g. `npx notionx update`)
- Config directory: `.nextion/` → `.notionx/`
- Environment variables: `CREATE_NEXTION_*` → `CREATE_NOTIONX_*`, `NEXTION_PROVISION_DISABLED` → `NOTIONX_PROVISION_DISABLED`
- API: `createNextionWorker` → `createNotionxWorker`, `runNextionDoctor` → `runNotionxDoctor`
- User command: `npm create notionx@latest`

Physical directory names and internal file names also renamed to match
(packages/notionx/, packages/create-notionx-app/, cli-notionx.ts, etc.).
