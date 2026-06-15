# Notion Secret Sync Design

## Summary

This design fixes a gap in the current Nextion scaffold and upgrade flow:
Notion-backed blog projects can end up with working local `.dev.vars` values but
missing production Worker secrets for `NOTION_DATA_SOURCE_ID` and
`NOTION_PAGES_DATA_SOURCE_ID`.

Today that produces a confusing failure mode:

- local development works
- the first live deploy succeeds
- the public `/blog` route renders an empty state because the Worker does not
  know which Notion data sources to query

The fix has two parts:

1. new projects automatically sync the required Notion ids to Worker secrets
   during provisioned deploys
2. existing projects can recover by running `nextion update`, which detects the
   same drift and backfills the missing Worker secrets without asking the user
   to re-enter values that already exist locally

The design keeps `nextion update` as the explicit maintenance command for
existing projects. It does not make `npm update` or `pnpm update` mutate live
Cloudflare configuration implicitly.

## Goals

- Ensure Notion-backed public blog projects work on the first live deploy when
  the scaffold already knows the relevant Notion ids.
- Extend the current unified `nextion update` workflow so older projects can
  repair missing production Notion secrets automatically.
- Reuse existing project metadata and local env state instead of re-prompting
  for Notion configuration.
- Keep the repair idempotent and safe to rerun.
- Avoid downgrading secret handling by writing Notion ids into public
  `wrangler.jsonc` vars.
- Preserve the current operator mental model:
  - `npm create nextion-app` creates a project
  - `nextion update` upgrades and repairs an existing project

## Non-Goals

- Do not make plain `npm update` or `pnpm update` automatically mutate Worker
  secrets or trigger a live repair.
- Do not require a full re-scaffold for existing projects.
- Do not prompt the user to recreate Notion databases when the ids already
  exist in `.dev.vars` or scaffold metadata.
- Do not broaden this change into a generic "sync every env var to Cloudflare"
  feature.
- Do not rewrite the public `wrangler.jsonc` contract for all Notion settings in
  this iteration.

## Problem

The current scaffold already knows enough information to configure a Notion blog
project:

- `NOTION_TOKEN`
- `NOTION_DATA_SOURCE_ID`
- `NOTION_PAGES_DATA_SOURCE_ID`
- optional block and site-settings data source ids

During project creation, the scaffold writes all of these values into
`.dev.vars`. That makes local development work.

During provisioned deploy, however, only `NOTION_TOKEN` is pushed as a Worker
secret. The two ids used by the public blog and page models are not pushed to
the Worker. They are also not written into `wrangler.jsonc`.

As a result, a generated project can look healthy but fail live:

- Cloudflare deploy succeeds
- health checks succeed
- `/blog` returns an empty state
- operators incorrectly suspect `Published` flags, Notion content, or cache
  problems

This is especially confusing because the scaffold-generated README already tells
users that production needs all three Notion values.

## Current State

### Creation and Provisioning

The current create flow collects or provisions Notion resource identifiers and
writes them into local project files:

- `.dev.vars`
- `wrangler.jsonc` for selected non-secret values such as block and site
  settings ids

Provisioned Worker secret sync currently sets:

- `TURNSTILE_SECRET_KEY`
- `NOTION_TOKEN`

It does not currently set:

- `NOTION_DATA_SOURCE_ID`
- `NOTION_PAGES_DATA_SOURCE_ID`

### Existing Project Upgrade

The current `nextion update` command already merges two concepts:

- template file sync
- provision repair inspection

That unified update model is already the right place to repair this bug for
existing projects. The missing piece is a repair entry that classifies absent
production Notion ids as safe, auto-applicable Cloudflare drift when the local
project already knows the values.

## User-Facing Behavior

### New Project

When a user creates a Notion-backed project and the scaffold has enough Notion
information to provision a deployable site, the first provisioned deploy should
also set these Worker secrets:

- `NOTION_TOKEN`
- `NOTION_DATA_SOURCE_ID`
- `NOTION_PAGES_DATA_SOURCE_ID`

If the project also relies on future Notion-managed sources that must stay
secret, the same helper can be extended later. This design only requires the two
production-critical ids above.

### Existing Project

Running:

```bash
npx nextion update
```

should inspect the current project and automatically repair this drift when all
of the following are true:

- the project is recognized as a Nextion scaffold consumer
- local config contains a non-empty `NOTION_DATA_SOURCE_ID`
- local config contains a non-empty `NOTION_PAGES_DATA_SOURCE_ID`
- the Cloudflare account is reachable
- the project has Notion-enabled content sources that depend on those ids

If those conditions hold, the update should add missing Worker secrets and print
a concise summary. The user should not be asked to manually re-enter the ids.

## Design

### Part 1: Provisioned Deploy Secret Sync

The provision flow should treat `NOTION_DATA_SOURCE_ID` and
`NOTION_PAGES_DATA_SOURCE_ID` as required production companions to
`NOTION_TOKEN` when Notion-backed blog/pages provisioning succeeded.

Recommended behavior:

- keep `NOTION_TOKEN` required when Notion provisioning is active
- add `NOTION_DATA_SOURCE_ID` as required when a public Notion content source
  depends on `NOTION_DATA_SOURCE_ID`
- add `NOTION_PAGES_DATA_SOURCE_ID` as required when the scaffold generated the
  Pages model and has a known pages data source id

If any required value is missing, the provision flow should surface an explicit
error explaining that live Notion content will be empty until the missing secret
is set.

The secret write path should continue using the existing `wrangler secret put`
helper so values never appear in shell history or command arguments.

### Part 2: Unified Update Repair Entry

`nextion update` already calls provision repair inspection before applying the
unified plan. This design extends that inspection to emit safe Cloudflare repair
entries for missing Notion Worker secrets.

Detection sources, in priority order:

1. local `.dev.vars`
2. scaffold metadata and generated config that can reconstruct the same values
3. other existing provision detection helpers already used by repair

The repair entry should be considered `safe` when:

- the local project has a concrete non-empty value
- the repair logic can verify that the corresponding Worker secret is absent or
  drifted
- applying the change only adds or aligns the secret and does not delete user
  data

The repair entry should be skipped when:

- the local project does not have the value
- the project is not Notion-backed
- the current project shape does not use the Pages data source

The repair entry should surface a conflict only if future work introduces a case
where the remote value is intentionally user-managed and differs in a way we do
not want to overwrite automatically. For this first version, missing or
same-value replacement is treated as safe.

### Part 3: Scope of Secret Sync

This design intentionally limits the automatic sync to:

- `NOTION_TOKEN`
- `NOTION_DATA_SOURCE_ID`
- `NOTION_PAGES_DATA_SOURCE_ID`

Rationale:

- these are the values required to make the generated public blog and page model
  function live
- the bug report is specifically about live content silently rendering empty
- keeping the scope tight reduces surprise and makes the update summary easy to
  understand

`NOTION_BLOCKS_DATA_SOURCE_ID` and `NOTION_SITE_SETTINGS_DATA_SOURCE_ID` remain
managed as they are today through generated config and existing provisioning
behavior. A future design can unify the full secret/var story if needed.

## Detection Rules

### Project Eligibility

The update repair runs only when:

- `.nextion/scaffold.json` exists
- the scaffold metadata indicates a Notion-backed project shape
- the generated project still contains the expected content/page model contract

If the project is missing scaffold metadata, `nextion update` should keep its
current behavior and fail with a clear "not a recognized Nextion project"
message.

### Value Discovery

The repair logic should read candidate values from local project state, not from
the live Worker:

- `NOTION_TOKEN` from existing secure/local sources already supported by the
  provision layer
- `NOTION_DATA_SOURCE_ID` from `.dev.vars` or equivalent generated env data
- `NOTION_PAGES_DATA_SOURCE_ID` from `.dev.vars` or equivalent generated env
  data

The design assumes `.dev.vars` is the authoritative local source for these ids
in generated projects.

### Remote Inspection

The repair inspector should query the current Worker secret names, compare them
by name only, and avoid reading or printing secret values.

Needed checks:

- is `NOTION_TOKEN` present
- is `NOTION_DATA_SOURCE_ID` present
- is `NOTION_PAGES_DATA_SOURCE_ID` present

If the remote secret listing is unavailable because the user is not logged in,
the update should report the authentication problem explicitly instead of
silently skipping the repair.

## Safety Model

### Why Worker Secrets, Not `wrangler.jsonc` Vars

The Notion token must remain secret.

The data source ids are not as sensitive as the token, but this design still
uses Worker secrets for them because:

- the current bug is specifically about missing production runtime values
- the existing secret write helper already exists and is reliable
- keeping all production Notion runtime values in one secret-backed channel
  avoids splitting behavior across `vars` and `secret put`
- it prevents older projects from exposing more Notion configuration publicly
  just to repair this bug

### Idempotency

Repeated runs of `nextion update` should:

- leave already-aligned secrets unchanged
- reapply the same values safely if the implementation path uses `secret put`
- avoid re-prompting for values that are already available locally

### Failure Handling

If update cannot repair the secret drift, it should produce actionable messages:

- missing local `NOTION_DATA_SOURCE_ID`
- missing local `NOTION_PAGES_DATA_SOURCE_ID`
- Cloudflare authentication unavailable
- Worker secret write failed

The message should tell the operator whether:

- the update completed except for live Notion repair
- a manual retry is needed
- local template updates still succeeded

## Implementation Shape

### Provision Layer

Update the provision secret sync helper so it can accept multiple required
Notion secret names instead of only `NOTION_TOKEN`.

Recommended shape:

- keep one helper responsible for secure `wrangler secret put`
- build the required Notion secret set from available `WireInputs`
- fail provisioned live setup if a required Notion value is missing when the
  generated project depends on it

### Repair Inspection Layer

Extend provision inspection so it can emit safe `UnifiedUpdateEntry` records for
missing Notion Worker secrets.

Each emitted entry should:

- have `group: "cloudflareBinding"`
- have `risk: "safe"`
- write the named secret using the same secure helper already used by provision
- label the action clearly, for example `cloudflare-secret:NOTION_DATA_SOURCE_ID`

### CLI Summary

The unified update summary should make this repair visible. Example output:

```text
safe updates:
  - cloudflare-secret:NOTION_DATA_SOURCE_ID
  - cloudflare-secret:NOTION_PAGES_DATA_SOURCE_ID
follow-up:
  - run `pnpm install`
```

If only secret repair ran, no install follow-up should be printed.

## Testing

### Unit Tests

- provision helper sets `NOTION_DATA_SOURCE_ID` and `NOTION_PAGES_DATA_SOURCE_ID`
  when present
- provision helper throws a clear error when a required Notion production value
  is missing
- repair inspector emits safe Cloudflare update entries for missing Notion
  secrets when local values exist
- repair inspector skips those entries when local values are absent
- unified update summary includes the new repair labels cleanly

### Integration Tests

- scaffold a Notion-backed project, simulate provision with known ids, and
  verify that the secret sync helper is called for all required Notion values
- run `nextion update` against a fixture project with local ids present and
  remote secret names missing; verify that the unified update applies the repair
  without prompting for reconfiguration
- rerun the same update and verify idempotent behavior

## Migration And Rollout

### New Projects

New scaffolds benefit as soon as the updated package is published.

### Existing Projects

Existing projects recover by running:

```bash
npx nextion update
```

The command should detect the already-known local configuration and repair the
live Worker without requiring the original scaffold answers.

### Documentation

Update the public docs and generated README guidance so the operator message is
consistent:

- `npm create nextion-app` creates a project
- `npx nextion update` upgrades and repairs an existing project
- plain package-manager update commands do not automatically mutate Cloudflare
  runtime configuration

## Open Questions Resolved

- Repair entrypoint: use `nextion update`, not plain `npm update`
- New-project fix: include the missing Notion ids in provisioned Worker secret
  sync
- Existing-project fix: detect local ids and backfill missing Worker secrets
  automatically
- Configuration reuse: prefer already-known project values; do not re-prompt
