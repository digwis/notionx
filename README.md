# vinext

vinext is a Next.js / App Router–style framework for [Cloudflare Workers](https://workers.cloudflare.com/). This repository is the official pnpm monorepo maintained by the vinext team: the reusable platform layer is bundled and published as `@vinext/foundation` to GitHub Packages, a reference business implementation lives in `apps/moviebluebook/`, and the project scaffolding tool lives in `tools/create-vinext-app/`.

## Architecture

vinext is a pnpm monorepo: the reusable platform, authentication, admin shell, and Notion toolkit are all extracted into the `@vinext/foundation` package. New projects only need `pnpm create vinext-app my-new-site` plus a few `defineContentSource(...)` calls to get full authentication, admin, and Cloudflare deployment out of the box. The repository layout, the seven dependency layers, the four boundary contracts (`ContentSource` / `AuthConfig` / `AdminExtension` / `WorkerOptions`), and the distribution model are all described in detail in [`docs/architecture/foundation-package.md`](docs/architecture/foundation-package.md).

- Full architecture overview: [`docs/architecture/foundation-package.md`](docs/architecture/foundation-package.md)
- Creating a new project: [`docs/architecture/creating-new-project.md`](docs/architecture/creating-new-project.md)
- Adding / modifying content domains: [`docs/architecture/customizing-content-source.md`](docs/architecture/customizing-content-source.md)
- Upgrading `@vinext/foundation`: [`docs/architecture/upgrading-foundation.md`](docs/architecture/upgrading-foundation.md)
- Release notes: [`docs/architecture/foundation-changelog.md`](docs/architecture/foundation-changelog.md)
- Legacy content-foundation docs (no longer authoritative): [`docs/architecture/content-foundation.md`](docs/architecture/content-foundation.md)

## Repository layout

```text
packages/foundation/        # Compiled and published as @vinext/foundation
apps/moviebluebook/         # Reference business app (consumes @vinext/foundation)
tools/create-vinext-app/    # `pnpm create vinext-app` scaffolding
docs/                       # Architecture docs and design specs
```

## Local development

```bash
pnpm install
pnpm --filter @vinext/foundation build
pnpm --filter @vinext/moviebluebook dev
```

## Testing and diagnostics

```bash
pnpm -r test
pnpm --filter @vinext/foundation foundation:doctor
```
