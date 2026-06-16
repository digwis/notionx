# notionx

notionx is a pnpm monorepo for the Notion-powered Cloudflare stack behind the
published `@notionx/*` packages. This repository is the framework source, not a
deployable user app: it contains the reusable runtime, the scaffolder, the
unscoped `npm create` shim, the skill installer, and the release tooling used
to publish those packages to npm.

## What Lives Here

- `@notionx/core`: the runtime and framework primitives for Cloudflare Workers
- `@notionx/create-notionx-app`: the scaffolder and `notionx` maintenance CLI
- `create-notionx`: the unscoped shim behind `npm create notionx`
- `@notionx/skill`: the packaged notionx skill installer

End users should create a separate app repository with `npm create notionx`
and deploy that generated project to Cloudflare. This monorepo stays focused on
framework and release work.

## Repository Layout

```text
packages/nextion/                 # Published as @notionx/core
packages/create-nextion-app/      # Published scaffolder + `notionx` CLI
packages/create-nextion-app-shim/ # Published `npm create notionx-app` shim
packages/nextion-skill/           # Published skill installer
scripts/                          # Release and repository automation
docs/                             # Architecture, publishing, and design docs
skills/                           # Skill source material bundled by the installer
```

## Key Docs

- Architecture overview: [`docs/architecture/notionx-package.md`](docs/architecture/notionx-package.md)
- Create a new project: [`docs/architecture/creating-new-project.md`](docs/architecture/creating-new-project.md)
- Customize content sources: [`docs/architecture/customizing-content-source.md`](docs/architecture/customizing-content-source.md)
- Upgrade generated projects: [`docs/architecture/upgrading-notionx.md`](docs/architecture/upgrading-notionx.md)
- Unified registry protocol (v2, planned): [`docs/architecture/registry-protocol.md`](docs/architecture/registry-protocol.md)
- Publish packages: [`docs/PUBLISHING.md`](docs/PUBLISHING.md)
- Release notes: [`docs/architecture/notionx-changelog.md`](docs/architecture/notionx-changelog.md)

## Local Development

```bash
pnpm install
pnpm --filter @notionx/core build
pnpm --filter @notionx/create-notionx-app test
pnpm --filter @notionx/skill test
```

## Repository Checks

```bash
pnpm -r test
pnpm -r typecheck
pnpm -r lint
pnpm release:status
```
