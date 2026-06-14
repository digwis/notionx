---
"@notionx/create-nextion-app": patch
---

Fix: scaffolds no longer pin `@notionx/core` to the un-published `^0.5.2`
range (which made `pnpm install` fail with
`ERR_PNPM_NO_MATCHING_VERSION`). The interactive prompt and the
`--yes` non-interactive path now both honor the version that
`resolveNextionSource()` produces (live npm registry, monorepo
`workspace:*`, or `FALLBACK_NEXTION_SOURCE` as last resort),
instead of discarding it in favor of a hard-coded literal.
`FALLBACK_NEXTION_SOURCE` in `nextion-source.ts` is now exported
and reused by `prompt.ts` / `answers.ts` so there is a single
source of truth for the caret range.
