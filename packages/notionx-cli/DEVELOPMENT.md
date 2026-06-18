# Development — `@notionx/cli`

This file is for **monorepo maintainers**. End-user documentation lives in
[`README.md`](./README.md) (which is what npmjs.com shows).

## Build & test

From the vinext monorepo root:

```bash
# Build
pnpm --filter @notionx/cli build

# Run from source (no build needed)
pnpm --filter @notionx/cli dev -- /tmp/my-app

# After changing templates, re-run the build to copy them into dist/
pnpm --filter @notionx/cli build
```

## Smoke test

```bash
# Build, then scaffold into a temp dir
pnpm --filter @notionx/cli build
node packages/notionx-cli/dist/index.js /tmp/cna-smoke --yes \
  --notionx-source "^0.1.0"
cd /tmp/cna-smoke
pnpm install
pnpm test
```

## Source layout

```
src/
  index.ts                 CLI entry point — wires prompt → render → provision
  prompt.ts                @clack/prompts flow → typed Answers (minimal: project name + confirm)
  answers.ts               CLI flag parser + non-interactive gatherAnswers
  render.ts                Filesystem writer; copies templates, interpolates {{tokens}}
  templates/               The generated project's source files
  provision/
    index.ts               Orchestrator (wrangler auth → D1 → KV → R2 → Notion …)
    cloudflare.ts          D1 / KV / R2 — calls `wrangler ... --json`
    notion.ts              Notion data-source creation via the `ntn` CLI
    wire.ts                Patches wrangler.jsonc + writes .dev.vars
    prompts.ts             Per-step @clack/prompts (Turnstile, Resend, Google…)
    shell.ts               run() — child_process.spawn helper
    dependencies.ts        ensureDependencies() — auto-installs wrangler / ntn
```

Templates use `{{token}}` placeholders. The render step substitutes them
from the `TokenMap` built in `render.ts`. Files with a `.tmpl` extension
are rendered then written **without** the suffix; everything else is
copied verbatim.

## Adding a new template

1. Drop the file under `src/templates/` (use `.tmpl` for interpolated files).
2. If you need new tokens, extend the `TokenMap` and the `buildTokenMap`
   helper in `render.ts`.
3. Rebuild with `pnpm --filter @notionx/cli build` so
   `copy-templates.mjs` copies the new file into `dist/templates/`.

## Publishing a new version

```bash
# Bump version in packages/notionx-cli/package.json
# Major bump only if the prompt UX or template shape changes.

pnpm --filter @notionx/cli build
cd packages/notionx-cli
npm publish --access public
```

Requires an npm token with `packages and scopes: @notionx` and
`bypass_2fa: true`. See [the repo's publish docs](../../docs/PUBLISHING.md).
