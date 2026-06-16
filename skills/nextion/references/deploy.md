# Deploy & CI

## Local dev loop

```bash
cp .dev.vars.example .dev.vars
# fill in NOTION_TOKEN, NOTION_<DOMAIN>_DATA_SOURCE_ID, RESEND_API_KEY, TURNSTILE_*, etc.

pnpm install
pnpm dev                    # generated script runs `vinext dev --port 3001`
```

`pnpm dev` boots vinext (Vite + Next.js App Router on Cloudflare Workers'
edge-style runtime). Generated projects use Node >= 22.

## Pre-deploy checklist

Run these locally **before every deploy**. If any fails, do not deploy.

```bash
pnpm notionx:doctor         # offline config check, if the project exposes this script
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## First-time deploy

```bash
# 1. Create the D1 database in the Cloudflare dashboard
#    copy the database_id into wrangler.jsonc -> d1_databases[0].database_id

# 2. Create KV, R2, Queue, etc. as declared in wrangler.jsonc

# 3. Push secrets
pnpm exec wrangler secret put NOTION_TOKEN
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
# ... any other secret

# 4. Apply D1 migrations
pnpm exec wrangler d1 migrations apply <db-name> --remote

# 5. Deploy
pnpm exec vinext deploy
# or `pnpm deploy` if the generated package.json script is present
```

## Deploying updates

For code-only changes:

```bash
pnpm exec vinext deploy
```

For changes that include a new migration:

```bash
pnpm exec wrangler d1 migrations apply <db-name> --remote
pnpm exec vinext deploy
```

For changes to bindings (`wrangler.jsonc`):

```bash
pnpm exec vinext deploy    # wrangler picks up wrangler.jsonc on deploy
# then in Cloudflare dashboard, verify the binding actually exists
```

## CI: GitHub Actions pattern

The reference canary (`apps/moviebluebook` in the monorepo) and consumer
projects should have a workflow like:

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
        env:
          # Use fake / dummy secrets for build
          NOTION_TOKEN: test
          RESEND_API_KEY: test
          TURNSTILE_SITE_KEY: test
          TURNSTILE_SECRET_KEY: test
```

Run `notionx:doctor` in CI only if the workflow provides the expected dummy env
and scaffold metadata. It is primarily a local offline check.

## Dependabot for `@notionx/core`

Recommended `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly", day: "monday" }
    allow:
      - dependency-name: "@notionx/core"
    labels: ["dependencies", "notionx"]
    groups:
      notionx-patch:
        applies-to: version-updates
        update-types: ["minor", "patch"]
```

Pair it with a `dependabot-auto-merge.yml` that auto-merges patch/minor on
green CI; **major upgrades must always be reviewed by hand** after reading
the [Notionx Changelog](https://github.com/digwis/nextion/blob/main/docs/architecture/notionx-changelog.md).

## Scaffolder-driven sync

Two scaffolder commands that are part of the deploy story:

- `npx notionx update` — sync scaffold-owned files with the latest
  `create-notionx-app` templates. Current managed files are `package.json`,
  `wrangler.jsonc`, `README.md`, `.notionx/scaffold.json`, and
  `.dev.vars.example`. Default: no cloud side effects.
- `npx notionx provision repair` — reconcile Notion schemas, Cloudflare
  bindings, and secrets. Does write to cloud resources (only the diff).
  Default: no deploy.

Run them in this order: doctor → update → repair → deploy.

## When in doubt

```bash
pnpm notionx:doctor
```

It is offline, reads only your local files, and never prints secrets.
