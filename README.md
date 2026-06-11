# vinext

vinext is a Next.js / App Router–style framework for [Cloudflare Workers](https://workers.cloudflare.com/). This repository is the official pnpm monorepo maintained by the vinext team: the reusable platform layer is bundled and published as `@notionx/core` to GitHub Packages, a reference business implementation lives in `apps/moviebluebook/`, and the project scaffolding tool lives in `packages/create-nextion-app/`.

## Architecture

vinext is a pnpm monorepo: the reusable platform, authentication, admin shell, and Notion toolkit are all extracted into the `@notionx/core` package. New projects only need `pnpm create nextion-app my-new-site` plus a few `defineContentSource(...)` calls to get full authentication, admin, and Cloudflare deployment out of the box. The repository layout, the seven dependency layers, the four boundary contracts (`ContentSource` / `AuthConfig` / `AdminExtension` / `WorkerOptions`), and the distribution model are all described in detail in [`docs/architecture/nextion-package.md`](docs/architecture/nextion-package.md).

- Full architecture overview: [`docs/architecture/nextion-package.md`](docs/architecture/nextion-package.md)
- Creating a new project: [`docs/architecture/creating-new-project.md`](docs/architecture/creating-new-project.md)
- Adding / modifying content domains: [`docs/architecture/customizing-content-source.md`](docs/architecture/customizing-content-source.md)
- Upgrading `@notionx/core`: [`docs/architecture/upgrading-nextion.md`](docs/architecture/upgrading-nextion.md)
- Release notes: [`docs/architecture/nextion-changelog.md`](docs/architecture/nextion-changelog.md)
- Legacy content-nextion docs (no longer authoritative): [`docs/architecture/content-nextion.md`](docs/architecture/content-nextion.md)

## Repository layout

```text
packages/nextion/        # Compiled and published as @notionx/core
apps/moviebluebook/         # Reference business app (consumes @notionx/core)
packages/create-nextion-app/    # `pnpm create nextion-app` scaffolding
docs/                       # Architecture docs and design specs
```

## Local development

```bash
pnpm install
pnpm --filter @notionx/core build
pnpm --filter @nextion/moviebluebook dev
```

## Testing and diagnostics

```bash
pnpm -r test
pnpm --filter @notionx/core nextion:doctor
```
