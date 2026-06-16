# @notionx/create-notionx-app

Scaffold a new [vinext](https://github.com/digwis/nextion) project that consumes
[`@notionx/core`](https://www.npmjs.com/package/@notionx/core). The generated
project runs on **Cloudflare Workers + D1 + R2**, ships a single
**Notion-backed** content source, and comes pre-wired with auth, admin, and
health routes — all from one command.

> **TL;DR**
> ```bash
> npx @notionx/create-notionx-app my-app
> cd my-app
> pnpm install
> pnpm dev
> ```

---

## Quick start

### One command, one question

```bash
npx @notionx/create-notionx-app my-app
```

The CLI asks exactly two things — your **project name** and a final
**confirmation**. Everything else (locale, content-source shape, etc.) uses
sensible defaults that you can edit in the generated project.

### Skip prompts entirely

```bash
npx @notionx/create-notionx-app my-app --yes
```

### Custom install location

```bash
npx @notionx/create-notionx-app ./projects/my-app
```

### Pin a specific `@notionx/core` version

```bash
# In a published project (no monorepo workspace):
npx @notionx/create-notionx-app my-app --nextion-source "^0.1.0"

# In a monorepo that also hosts the @notionx/core source:
npx @notionx/create-notionx-app my-app \
  --nextion-source "link:../vinext-monorepo/packages/nextion"
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

- `npx notionx locale add <locale>` — dry run
- `npx notionx locale add <locale> --apply` — writes scaffold metadata
  and the locale config (no Notion calls)
- `npx notionx locale add <locale> --with-notion --apply [--copy-from <locale>]`
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
| `--nextion-source <spec>` | `@notionx/core` dependency value (default: `workspace:*`) |
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

Repository: <https://github.com/digwis/nextion/tree/main/packages/nextion>

## License

MIT © [zhaofilms](https://github.com/digwis/nextion)
