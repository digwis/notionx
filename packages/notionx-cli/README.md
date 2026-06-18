# @notionx/cli

Create, update, diagnose, and provision Notionx projects that consume
[`@notionx/core`](https://www.npmjs.com/package/@notionx/core). Generated
projects run on **Cloudflare Workers + D1 + R2**, ship Notion-backed content
sources, and include the `notionx` maintenance command for future upgrades.

> **TL;DR**
> ```bash
> npm create notionx@latest my-app
> cd my-app
> pnpm install
> pnpm dev
> ```

---

## Quick start

### One command, one question

```bash
npm create notionx@latest my-app
```

The CLI asks exactly two things — your **project name** and a final
**confirmation**. Everything else (locale, content-source shape, etc.) uses
sensible defaults that you can edit in the generated project.

### Skip prompts entirely

```bash
npm create notionx@latest my-app -- --yes
```

### Custom install location

```bash
npm create notionx@latest ./projects/my-app
```

### Pin a specific `@notionx/core` version

```bash
# In a published project (no monorepo workspace):
npm create notionx@latest my-app -- --notionx-source "^0.1.0"

# In a monorepo that also hosts the @notionx/core source:
npm create notionx@latest my-app -- \
  --notionx-source "link:../vinext-monorepo/packages/notionx"
```

## What gets generated

```
my-app/
├── app/                        # App-Router pages
│   ├── page.tsx                # landing page
│   ├── login/page.tsx          # email/password login
│   └── api/                    # health + auth endpoints
├── worker/index.ts             # createNotionxWorker + vinext fallthrough
├── lib/                        # site/auth/admin/content config
├── components/ui/              # shadcn/ui primitives
├── migrations/0001_init.sql    # auth schema
├── wrangler.jsonc              # D1 + KV + R2 + Assets bindings
├── .dev.vars.example           # secret keys placeholder
└── package.json
```

## Interactive provisioning

When the CLI finishes writing files, it offers to provision your
**Cloudflare**, **Notion**, **Turnstile**, **Resend**, and **Google OAuth**
accounts in one shot. If you accept, it will:

1. Verify your `wrangler` login (and offer to install it / upgrade to v4 if not)
2. Create the **D1** database, **KV** namespace, and **R2** bucket
3. Patch `wrangler.jsonc` and `.dev.vars` with the resulting IDs
4. Apply D1 migrations to your local Miniflare store
5. Create a **Notion** data source with seeded sample pages
6. Optionally configure **Turnstile**, **Resend**, and **Google OAuth**

If you decline, the project is fully scaffolded but you'll need to wire
resources manually — see the README generated inside the project.

## Adding a locale

The generated project supports a multilingual foundation out of the box
(blog, pages, blocks, and site settings each get a `base + translations`
pattern in Notion). To enable an additional locale on an existing
project, see the `Multilingual foundation` section in the generated
project README for the full flow:

- `pnpm exec notionx locale add <locale>` — dry run
- `pnpm exec notionx locale add <locale> --apply` — writes scaffold metadata
  and the locale config (no Notion calls)
- `pnpm exec notionx locale add <locale> --with-notion --apply [--copy-from <locale>]`
  — provisions the four translation data sources in Notion and pushes
  the resulting data source ids as worker secrets

The command refuses to remove or overwrite existing locales. Re-running
with the same locale is a no-op (the validator returns
"already in supportedLocales").

## Requirements

- **Node.js 22+** (`node --version`)
- **pnpm 9+** for the generated project (`npm install -g pnpm`)
- A **Cloudflare** account (free tier is fine) — only needed if you accept provisioning
- A **Notion** integration token — same

## Flags

| Flag | Description |
|---|---|
| `[target-dir]` | Output directory (positional, default: `./<project-name>`) |
| `--project-name <name>` | Project name (kebab/lower case). Other settings use defaults. |
| `--target-dir <dir>` | Output directory (default: `./<project-name>`) |
| `--notionx-source <spec>` | `@notionx/core` dependency value (default: `workspace:*`) |
| `-y`, `--yes` | Skip the confirmation prompt |
| `-h`, `--help` | Print help |

## What is `@notionx/core`?

The runtime framework. New projects get it as a dependency; the generated
code uses:

- `createNotionxWorker(...)` — the Cloudflare Worker entry
- `defineContentSource(...)` — a Notion-backed content source
- `createAuth(authConfig)` — email/password + OAuth login
- `AdminExtension` — server-rendered admin shell
- `WorkerOptions` — wrangler bindings, secrets, image transforms

Repository: <https://github.com/digwis/notionx/tree/main/packages/notionx>

## License

MIT © [zhaofilms](https://github.com/digwis/notionx)
