---
"@notionx/create-nextion-app": patch
"create-nextion-app": patch
---

Fix the Notion blog scaffold so production deployments and later `nextion update`
repair runs sync the required Worker secrets for blog content. Also update the
unscoped `create-nextion-app` shim to point at the repaired scoped release so
`npm create nextion-app` installs the fixed scaffolder.
