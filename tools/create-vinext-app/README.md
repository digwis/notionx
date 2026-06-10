# create-vinext-app

Scaffolds a new [vinext](https://github.com/your-username/vinext) project that
consumes `@vinext/foundation`. The generated project is bootable on Cloudflare
Workers + D1 + R2 + Cloudflare Images, ships a single Notion-backed content
source, and is wired to the foundation's auth, admin, and health routes.

## Usage (monorepo)

From the vinext monorepo root:

```bash
pnpm --filter create-vinext-app build
node tools/create-vinext-app/dist/index.js /tmp/my-app
```

The interactive prompt asks for:

- Project name + target directory
- Default + supported locales
- A first content source id, title, and field names

The renderer writes the project to disk, then prints the next-step commands
(`pnpm install`, `cp .dev.vars.example .dev.vars`, `pnpm dev`).

## Development

Run from source (no build step required):

```bash
pnpm --filter create-vinext-app dev -- /tmp/my-app
```

## Layout

```
src/
  index.ts          CLI entry point
  prompt.ts         @clack/prompts flow → typed Answers
  render.ts         Filesystem writer; copies templates, interpolates {{tokens}}
  templates/        The generated project's source files
```

Templates use `{{token}}` placeholders. The render step substitutes them from
the `TokenMap` built in `render.ts`. Files with a `.tmpl` extension are
rendered then written without the suffix; everything else is copied verbatim.

## Adding a new template

1. Drop the file under `src/templates/` (use `.tmpl` for interpolated files).
2. If you need new tokens, extend the `TokenMap` and the `buildTokenMap` helper
   in `render.ts`.
3. Rebuild with `pnpm --filter create-vinext-app build`.
