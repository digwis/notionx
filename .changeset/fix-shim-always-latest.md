---
"@notionx/create-notionx-app": patch
"create-notionx": patch
---

Make `create-notionx` shim always pull latest scaffold via `npx --yes @notionx/create-notionx-app@latest`

Previously the shim declared `@notionx/create-notionx-app` as a dependency,
so `npx` cached whatever version was current at first run and never updated
it. Now the shim is dependency-free and delegates to `npx --yes` on every
invocation, guaranteeing the newest published scaffold.
