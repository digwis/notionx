# Troubleshooting

Always start with `pnpm notionx:doctor` before guessing. It is offline and
never prints secrets.

```bash
pnpm notionx:doctor
```

If doctor is clean but the symptom persists, work through the recipes below.

## "Dev server won't start"

Symptom: `pnpm dev` exits or hangs.

1. Check Node version: `node -v` must be **>= 22**.
2. Check that `pnpm install` succeeded and `pnpm-lock.yaml` is present.
3. Check `.dev.vars` exists. If missing: `cp .dev.vars.example .dev.vars` and fill it.
4. Check that no other process is on the dev port (default 3000 / 5173 depending
   on vinext version; current generated projects use port 3001).
5. Clear `.vinext/` and `.wrangler/` caches:
   `rm -rf .vinext .wrangler node_modules/.vite && pnpm install && pnpm dev`.

## "Doctor complains about a missing env var"

The env var is declared in `wrangler.jsonc#vars` (or referenced in a
`defineContentSource` config), but the local file doesn't have it. Either:

- Add it to `.dev.vars` (for `pnpm dev`).
- Or add it to `wrangler.jsonc#vars` (for `pnpm exec wrangler ...`).
- Or `pnpm exec wrangler secret put <NAME>` (for prod-only secrets).

Be careful: doctor inspects both `wrangler.jsonc` and `.dev.vars` and tells
you which one is the source of truth for each var.

## "Notion data not showing up on the public site"

1. Visit `/admin/content-models`. Is the source listed with the right env var
   and a non-zero record count?
2. Is the env var set in `.dev.vars` **and** in `wrangler.jsonc#vars`?
3. Is the Notion token valid? Try `curl -H "Authorization: Bearer $NOTION_TOKEN"
   https://api.notion.com/v1/users/me` to confirm.
4. Is the `dataSourceId` correct? Open the Notion data source, copy the id
   from the URL, paste into the env var.
5. Is the page's `Published` or project-specific status field set to the value
   your page/API helper expects? Check the local route code and Notion helpers
   before assuming a default filter.
6. Run `prewarmContentModel("<id>")` to force a re-index.

## "Webhook from Notion doesn't reach the app"

Symptom: editing a page in Notion does not invalidate the cache / does not
update the public site.

1. Did you register the webhook URL in Notion? It should be
   `https://<your-domain>/api/notion/webhook`.
2. Is the project's Notion webhook secret/verification env var set? Check
   `wrangler.jsonc`, `.dev.vars`, and `packages/nextion/src/notion/webhook.ts`
   for the exact current name.
3. Is the worker actually deployed at that URL? Visit `/api/health` to confirm.
4. Look at Cloudflare Worker logs for `/api/notion/webhook` to see the
   incoming request and the response status.
5. Verify the page belongs to a `dataSourceId` that is referenced by a
   registered `ContentSource`. The webhook handler ignores unknown data
   sources.

## "Admin login fails"

1. Have you applied the migrations?
   `pnpm exec wrangler d1 migrations apply <db> --remote` (or `--local` for dev).
2. Is the D1 binding name in `wrangler.jsonc` the same as in
   `authConfig.databaseBinding`?
   Default: `"DB"`.
3. Is the admin user pre-seeded? `migrations/0002_admin_seed.sql` may need to
   be edited to include the project owner's email, then re-applied.
4. Is the email verified? The package requires email verification before
   the user can log in. Check the Resend dashboard for the verification
   email, or look at `email_verifications` in D1.
5. Is Turnstile misconfigured? Check `authConfig.turnstile.siteKeyEnv` and
   `secretKeyEnv`, plus the matching env vars. Do not invent an `enabled` field
   unless the local project API has one.

## "Cache won't invalidate after Notion edit"

1. Webhook is reaching the app? See above.
2. Did you add a `routes` entry in the `ContentSource` config? Without
   `routes.listPath` and `routes.detailPath` the package has nothing to
   invalidate.
3. Force a manual invalidation: `revalidateContentModel("<id>")` from
   `@notionx/core/content`. If that works, the issue is webhook delivery.

## "R2 image URL returns 404"

1. Is the R2 binding declared in `wrangler.jsonc`? Default binding name: `R2`.
2. Is the bucket public? The package exposes `/api/cdn/<key>` for public
   reads; check that route exists in your build.
3. Did you upload the file via the admin panel or via the `storage` module?
   Files dropped manually into R2 won't be tracked.

## "Build fails with type errors after upgrading `@notionx/core`"

1. Read the [Notionx Changelog](https://github.com/digwis/nextion/blob/main/docs/architecture/notionx-changelog.md)
   for the new version. Major versions include migration notes.
2. The most common cause is that a subpath got renamed. Check the
   `exports` field of `node_modules/@notionx/core/package.json` for the
   current list of public subpaths.
3. Run `npx notionx update` to sync any scaffolder-owned files (config,
   README, etc.).

## "Deploy fails with 'binding not found'"

1. Did you create the binding in the Cloudflare dashboard?
2. Is the binding name in `wrangler.jsonc` (and your `AuthConfig`, if it's D1
   or R2) **exactly** matching? Case-sensitive.
3. For R2: did you run `wrangler r2 bucket create <bucket>`?
4. For KV: did you run `wrangler kv namespace create <namespace>` and copy
   the returned id into `wrangler.jsonc`?
5. For D1: did you copy the `database_id` from the dashboard into
   `wrangler.jsonc#d1_databases[0].database_id`?

## "ESLint blocks my PR for cross-layer import"

You are likely editing `@notionx/core` itself and importing upwards. Read
[architecture.md](architecture.md) for the layer table. The fix is to move
the import to a lower layer or extract the shared piece into a helper that
lives in the lower layer.

## Still stuck?

1. `pnpm notionx:doctor` — output verbatim.
2. Output of `pnpm --filter @notionx/core test` (or `pnpm test` in the
   consumer).
3. Relevant log lines from `pnpm exec wrangler tail` (for prod) or the dev
   server output (for local).
4. The exact `wrangler.jsonc` binding names and `.dev.vars` env names.

Then file an issue at https://github.com/digwis/nextion/issues with those
artifacts. Never paste secrets.
