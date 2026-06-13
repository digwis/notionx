# Scaffold Update And Provision Repair Design

## Summary

This design introduces two explicit maintenance commands for
`@notionx/create-nextion-app` generated projects:

- `nextion update`
- `nextion provision repair`

The goal is to stop using "rerun the scaffolder from scratch" as the default
way to evaluate the latest scaffold behavior. Instead, existing projects should
have a clear, low-risk path to:

- sync scaffold-managed local files
- repair and align external resources
- avoid unnecessary Cloudflare redeploys
- avoid unnecessary Notion database recreation

`@notionx/core` remains a separate concern and continues to be upgraded via the
package manager, not by these two commands.

## Goals

- Make the maintenance model easy to explain during rapid iteration:
  - core upgrade
  - scaffold update
  - provision repair
- Add a first-class `update` command that syncs scaffold-managed local project
  files without recreating the project.
- Add a first-class `provision repair` command that reuses and patches external
  resources instead of recreating them.
- Keep both commands idempotent and safe to rerun.
- Make it obvious which command a user should run when checking the latest
  scaffold effect.
- Preserve the current stable-key Notion reuse direction so repeated repair runs
  continue to patch existing databases in place.

## Non-Goals

- Do not replace `pnpm update @notionx/core` with a custom core upgrade flow in
  this first version.
- Do not make `update` automatically deploy the worker.
- Do not make `update` automatically repair external resources unless the user
  explicitly runs the repair command afterward.
- Do not build a full three-way merge engine for arbitrary user-modified files.
- Do not perform destructive migrations against Notion schema, D1 data, KV, or
  R2.

## Problem

The current CLI has a strong first-run flow:

- render a project
- provision Cloudflare resources
- provision Notion
- wire local config
- install dependencies
- attempt deploy

This is useful for creation, but it is not the right operator model for ongoing
development while the scaffold and `@notionx/core` are changing quickly.

Today, users do not have a dedicated way to answer these separate needs:

- "I want the newest scaffold template behavior in my existing project."
- "I changed provision logic and want to repair the current project's Notion /
  Cloudflare resources."
- "I only changed `@notionx/core` and want runtime behavior updates."

Without explicit commands, users are pushed toward rerunning creation logic or
manually replaying pieces of provisioning, which creates unnecessary resource
churn and extra deploy noise.

## Command Model

The maintenance model is explicitly split into three concerns:

- core upgrade: `pnpm update @notionx/core`
- scaffold update: `nextion update`
- external resource repair: `nextion provision repair`

The CLI introduced in this design covers the last two concerns only.

## User-Facing Behavior

### Core Upgrade

Core upgrade remains package-manager driven:

```bash
pnpm update @notionx/core
```

This updates runtime code that the project imports from `@notionx/core`. It
does not imply template syncing or external resource mutation.

### Scaffold Update

```bash
nextion update
```

This command updates scaffold-managed local files only. It is intended for
"show me the latest scaffold effect in my current project" workflows.

It should:

- detect whether the current directory is a Nextion-generated project
- load scaffold metadata for the current project
- compare the current project against the latest template output for the same
  project shape
- patch scaffold-managed files only when the scaffold-owned portion changed
- print a concise summary of changed files, skipped files, and manual follow-up

It should not:

- create or mutate Cloudflare resources
- create or mutate Notion resources
- run remote migrations
- deploy the worker automatically

### Provision Repair

```bash
nextion provision repair
```

This command repairs and aligns external resource state for an existing project.

It should:

- read the current project configuration
- check Cloudflare resources, bindings, secrets, and Notion resources
- reuse existing resources whenever possible
- patch only the missing or drifted pieces
- skip resources that are already aligned
- print a resource-by-resource status summary

It should not:

- rewrite general local template files beyond resource wiring files it owns
- recreate healthy resources by default
- reseed reused Notion databases
- deploy automatically

## Mental Model

The operator guidance should become:

- use `pnpm update @notionx/core` when runtime library behavior changed
- use `nextion update` when scaffold template or generated file behavior changed
- use `nextion provision repair` when Notion, Cloudflare, bindings, secrets, or
  resource wiring changed

For many rapid-iteration workflows, the expected sequence becomes:

1. update core if needed
2. run `nextion update`
3. run `nextion provision repair`
4. deploy only if you actually need to verify a live environment

## Proposed CLI Shape

The existing package is currently a create-only entry point. This design adds a
maintainer CLI surface for already-generated projects.

Recommended first-version command shape:

```bash
nextion update
nextion provision repair
```

The implementation may provide these through:

- a new `nextion` bin in the same package, or
- subcommands on the existing package entry with a stable executable alias

The exact bin wiring is an implementation detail, but the user-facing command
language should standardize on `nextion ...`.

## Project Metadata

Both commands need a reliable way to identify that a directory is a
Nextion-managed project and understand its scaffold shape.

The generated project should contain scaffold metadata sufficient to answer:

- which scaffold version created or last updated the project
- which content source preset was selected
- whether optional integrations were enabled at generation time
- which files are scaffold-managed versus user-owned

Recommended first-version approach:

- add a small project metadata file owned by the scaffold
- keep it stable and machine-readable
- treat it as the source of truth for `update` and `provision repair`

Example fields:

- scaffold package version
- content source id
- locale
- enabled auth/provider flags relevant to template shape
- generated-at version metadata

## `update` Design

### Scope

`update` operates on local scaffold-managed files only.

Examples of in-scope files:

- `package.json`
- `wrangler.jsonc`
- `.dev.vars.example` or equivalent generated env templates
- generated README / setup guidance
- generated app/router/page boilerplate
- scaffold-owned utilities and configuration files

Examples of out-of-scope files:

- user-authored business code not marked as scaffold-managed
- D1 remote state
- Notion databases
- Cloudflare remote resources

### Ownership Model

The command must distinguish among three file classes:

- fully scaffold-owned files
- partially scaffold-managed files with known editable regions
- user-owned files

First version recommendation:

- update full-file scaffold-owned files automatically
- support region-based patching only where delimiters are explicit and stable
- skip user-owned or ambiguous files with a clear manual message

This keeps the first version safe and avoids surprise overwrites.

### Update Strategy

For each scaffold-managed file:

1. generate the latest expected template output for the current project metadata
2. compare it against the on-disk file
3. if the file is unchanged from the previous scaffold-managed baseline, replace
   it automatically
4. if the file diverged in a scaffold-owned region only, patch that region
5. if the file contains user edits in an unsafe-to-merge area, skip it and
   report manual review required

This implies keeping either:

- a scaffold baseline snapshot, or
- enough deterministic metadata to regenerate the prior expected output for
  comparison

The design prefers deterministic regeneration plus a per-file ownership model
over storing a large baseline snapshot.

### Package Dependency Handling

`update` may patch scaffold-managed dependency ranges in `package.json` when the
template changed, but it should not silently force-install packages.

Recommended behavior:

- update `package.json`
- print `pnpm install` as a follow-up when dependency changes are detected
- optionally offer an explicit `--install` flag later, but not in the first
  version

### Output

The command should end with a concise summary:

- updated files
- skipped files
- files requiring manual merge
- whether `pnpm install` is required
- recommended next step: run `nextion provision repair` if resource shape also
  changed

## `provision repair` Design

### Scope

`provision repair` operates on external resources and scaffold-owned wiring that
connects those resources to the local project.

Examples of in-scope areas:

- D1 existence and binding alignment
- KV existence and binding alignment
- R2 existence and binding alignment
- worker secrets
- local wiring files tied to provisioned values
- local D1 migration application where appropriate
- Notion database reuse and schema patching

### Cloudflare Behavior

For Cloudflare resources, the command should:

- read desired resource names and bindings from project metadata and current
  scaffold rules
- check whether each resource already exists
- reuse existing resources when present
- create only missing resources
- patch binding ids or names in local wiring when drift is detected
- set or refresh required worker secrets when values are available

It must not:

- delete and recreate healthy resources by default
- automatically run a production deploy

### Notion Behavior

For Notion resources, the command should:

- reuse stable-key matched databases first
- fall back to legacy title matching only for backward compatibility
- patch scaffold markers onto legacy matches
- add missing schema fields only
- never reseed reused databases
- never overwrite editor-authored content

This command formalizes the stable reuse behavior as part of ongoing
maintenance, not just initial scaffolding.

### Migrations

The command may run safe local alignment steps that are already part of the
scaffold contract, such as local D1 migrations needed for developer workflows.

Remote migrations should be conservative:

- allowed only when explicitly requested, or
- reserved for a future flag such as `--remote`

First version recommendation:

- keep remote deploy and remote migration out of the default repair flow
- print follow-up commands when a remote step is still required

### Output

The command should report status per subsystem:

- D1
- KV
- R2
- worker secrets
- local wiring
- local migrations
- Notion content database
- Notion pages database

Each row should clearly indicate one of:

- reused
- created
- patched
- skipped
- failed

## Relationship Between The Commands

The commands intentionally do not call each other automatically.

Reasoning:

- users need to know which layer changed
- scaffold template changes and external resource changes often need different
  review habits
- separating them keeps failures easier to understand

The CLI may still print guidance such as:

- after `update`: "If your scaffold change also affects Notion or Cloudflare,
  run `nextion provision repair`."
- after `provision repair`: "If local scaffold files are outdated, run
  `nextion update`."

## Idempotency Rules

Both commands must be safe to rerun.

### `update`

- no-op when local scaffold-managed files already match the current template
- no duplicate file generation
- no repeated mutation of already-updated regions

### `provision repair`

- no-op when resources and wiring are already aligned
- no duplicate Notion database creation when stable keys already exist
- no duplicate sample content creation on reused Notion databases
- no unnecessary Cloudflare resource recreation

## Error Handling

### `update`

- if project metadata is missing or invalid, fail with a clear "not a Nextion
  project" or "cannot determine scaffold shape" message
- if a file cannot be safely merged, skip it and continue
- if template regeneration fails, abort without partially overwriting unrelated
  files

### `provision repair`

- if Cloudflare auth is missing, fail Cloudflare-related steps clearly but still
  allow a partial Notion-only or local-only repair path where possible
- if Notion auth is missing, skip Notion with a clear remediation hint
- if one subsystem fails, continue other independent repair steps when safe
- if a patch step would require destructive mutation, stop and report manual
  action required

## Documentation Changes

The project docs should introduce a permanent upgrade table:

- `pnpm update @notionx/core` -> runtime library upgrade
- `nextion update` -> scaffold template sync
- `nextion provision repair` -> external resource repair
- deploy command -> explicit live publish

The current upgrade doc should be expanded so users do not confuse these flows.

## Testing

Add focused coverage for:

- project detection and metadata parsing
- `update` file classification and skip behavior
- `update` idempotent reruns with no changes
- `update` patching scaffold-owned files without touching user-owned files
- `provision repair` reusing existing Cloudflare resources
- `provision repair` stable-key Notion reuse
- `provision repair` additive Notion schema patching
- `provision repair` not reseeding reused Notion databases
- summaries and remediation messages for partial failure cases

## Risks

- If file ownership boundaries are vague, `update` may either become too timid
  to be useful or too aggressive and overwrite user changes.
- If project metadata is insufficient, template regeneration may not know which
  variant of the scaffold to compare against.
- If Cloudflare and Notion repair are too tightly coupled, partial repair flows
  become hard to reason about.
- If users expect `update` to also repair resources automatically, docs and CLI
  output must make the separation explicit.

## Rollout Recommendation

Implement in this order:

1. add project metadata for generated apps
2. implement `nextion provision repair` on top of existing provision helpers
3. implement `nextion update` for fully scaffold-owned files first
4. expand docs and command summaries

This order reduces risk because resource reuse and repair are already closer to
the current codebase than safe template syncing.

## Validation

Validate the design with the following workflows:

- generate a project, modify scaffold code, run `nextion update`, and confirm
  only scaffold-managed files change
- rerun `nextion update` immediately and confirm it is a no-op
- provision a project once, rerun `nextion provision repair`, and confirm no
  new Notion databases or Cloudflare resources are created
- add a new Notion preset field, run `nextion provision repair`, and confirm
  only the missing field is added
- change only `@notionx/core`, run `pnpm update @notionx/core`, and confirm no
  scaffold or resource commands are required unless release notes say
  otherwise
