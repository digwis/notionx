---
"@notionx/create-nextion-app": patch
---

Fix two build errors caught by the CI release workflow: drop the unused `allowFailure` flag from the `notion-translation-sources` apply step (it isn't a `RunOptions` field) and add the `.js` extensions the relative imports in the new `locale-add/list.test.ts` need under Node16 module resolution.
