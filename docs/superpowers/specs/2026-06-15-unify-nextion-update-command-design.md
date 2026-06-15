# Unify Nextion Update Command Design

## Summary

This design collapses the current two-command upgrade model into a single
user-facing command: `nextion update`.

Today, upgrading a scaffolded Nextion project can require the operator to know
whether they need `nextion update` (template sync) or
`nextion provision repair` (Notion / Cloudflare reconciliation). That split
creates unnecessary cognitive load and makes older projects harder to maintain.

The new design makes `nextion update` the only upgrade command users need to
remember. It upgrades the runtime dependency, syncs scaffold-managed files,
reconciles provisioned resources, and automatically detects existing project and
Notion metadata. It does not force the user to re-enter Notion page ids or
re-run the original scaffold prompts.

The command follows one explicit safety rule:

- safe changes run automatically
- conflicting changes are grouped and confirmed together before applying

## Goals

- Make `nextion update` the single public upgrade command for existing Nextion
  projects.
- Upgrade `@notionx/core` by default as part of the update workflow.
- Reuse project metadata and provisioned resource identifiers automatically so
  users do not need to re-enter Notion parent pages or data source ids.
- Apply non-destructive code, config, schema, and resource updates
  automatically.
- Detect changes that may overwrite user customizations and present them as one
  confirmation step.
- Align older scaffolded projects to the latest starter behavior without
  requiring a full re-scaffold.

## Non-Goals

- Do not overwrite arbitrary user-owned application code.
- Do not silently replace edited Notion page content, block content, navigation,
  or Site Settings values.
- Do not require a deploy as part of `nextion update`.
- Do not require fully interactive setup when enough metadata already exists in
  the project.

## Current State

The current CLI exposes two separate upgrade paths:

- `nextion update`
  - renders scaffold-managed files into a temp directory
  - compares those files against the current project
  - writes updated or missing scaffold-owned files
- `nextion provision repair`
  - reconstructs non-interactive provision answers from
    `.nextion/scaffold.json`
  - reuses project metadata to repair Notion and Cloudflare state
  - does not re-prompt for the full scaffold flow

This split is technically reasonable but poor from a product perspective. Users
must decide which command to run and cannot rely on a single "bring my project
up to date" action.

## Proposed Command Model

### Public CLI

The CLI keeps exactly one public upgrade entrypoint:

```bash
nextion update
```

`nextion provision repair` is removed from the supported user-facing workflow.
Its implementation can remain internally as a module, but it is no longer a
documented or primary operator command.

### Command Contract

Running `nextion update` performs a full upgrade plan:

1. identify the project and validate that it is a Nextion scaffold consumer
2. inspect current local metadata and provisioned resource references
3. upgrade `@notionx/core` to the current recommended version
4. sync scaffold-managed files to the latest scaffold output
5. reconcile Notion / Cloudflare resources using the detected metadata
6. apply safe changes automatically
7. present all conflicts together for one confirmation decision
8. apply confirmed conflicts or leave them untouched
9. print a final summary and next steps such as `pnpm install`

## Detection And Reuse

### Project Detection

`nextion update` first loads project context from the current working directory.
The authoritative source remains:

- `.nextion/scaffold.json`

Additional project files may be consulted to enrich the plan:

- `package.json`
- `wrangler.jsonc`
- `.dev.vars.example`
- local env files when needed for bindings or token presence checks

If `.nextion/scaffold.json` is missing, the command fails with a clear message
that the project is not a recognized Nextion scaffold consumer.

### Resource Detection

The update flow must reuse existing metadata instead of asking the user to enter
Notion identifiers again. Resource detection should read from:

- scaffold metadata
- existing generated config and bindings
- current provision discovery logic
- any persistent token sources already supported by provisioning, such as local
  env files or platform-specific secure storage

The system should only ask for additional input when a critical identifier is
truly unavailable and cannot be inferred from the existing project.

## Upgrade Pipeline

### Phase 1: Scan

The command builds a normalized update context:

- project metadata
- installed and target `@notionx/core` version
- scaffold-managed file diff
- Notion schema and seed state
- Cloudflare binding / resource drift
- compatibility markers such as `legacy-vinext`

### Phase 2: Classify

Each candidate change is classified into one of two buckets:

- `safe`
- `conflict`

The classification result is collected before mutating conflicting targets so
the user gets one consolidated confirmation prompt rather than repeated
interruptions.

### Phase 3: Apply Safe Changes

Safe changes execute automatically. Examples:

- bump `@notionx/core` in `package.json`
- update scaffold-managed files that the user has not customized beyond the
  scaffold ownership boundary
- add missing bindings, vars, or non-breaking schema fields
- create missing generated files
- repair drift where the change is additive and does not overwrite an existing
  user-provided value

### Phase 4: Confirm Conflicts

If no conflicts are found, the command finishes automatically.

If conflicts exist, the command prints a grouped summary and offers exactly
three outcomes:

- apply all conflict updates
- apply only safe updates
- cancel

Conflict output is grouped by category so the operator can make one informed
decision:

- code template conflicts
- Notion content conflicts
- Cloudflare or binding conflicts

### Phase 5: Finalize

The command prints:

- what was updated automatically
- what was updated after confirmation
- what was skipped
- whether `pnpm install` is required
- whether manual deploy or follow-up validation is recommended

## Conflict Model

### Code And Template Conflicts

The current `update` flow already has a scaffold-managed file list. This design
extends that concept with conflict-aware behavior:

- scaffold-managed and unchanged relative to the user version: safe
- scaffold-managed but absent: safe
- scaffold-managed and changed only by the new scaffold output while the local
  file still matches the previously generated form: safe
- scaffold-managed and locally edited by the user in a way that overlaps with
  the new scaffold change: conflict
- non-scaffold-managed files: ignored by default

The upgrade engine must never treat arbitrary user files as upgrade targets just
because they exist under `app/`, `lib/`, or `components/`.

### Notion Conflicts

Notion updates are safe only when they are additive or fill an empty slot
without replacing a user value. Examples:

- adding a missing property to a managed data source: safe
- creating a missing managed page or managed settings row: safe
- filling a missing default value on a field that is currently empty: safe

The following are conflicts:

- changing existing page titles or block text that the user may have edited
- changing existing Site Settings values such as navigation, tagline, social
  image, or footer content when those fields are already populated
- replacing existing seeded content that is no longer empty

### Cloudflare And Binding Conflicts

Cloudflare changes are safe when they are additive and non-destructive:

- creating a missing binding
- adding a missing var
- restoring a missing resource mapping

They are conflicts when the target already exists but differs in a way that may
change runtime behavior, such as:

- a binding name mismatch
- a different referenced resource id
- a value move that would replace an existing binding contract

## Version Upgrade Behavior

`nextion update` upgrades `@notionx/core` by default.

The recommended version source should be the current scaffolder template output,
not an ad hoc network lookup. This keeps upgrade behavior deterministic and
aligned with the latest scaffold contract.

Legacy compatibility markers still apply. If a project explicitly requires
`workspace:*` preservation or another compatibility mode declared in metadata,
the unified update flow must preserve that behavior and surface it in the final
summary.

## Internal Architecture

The CLI remains thin. The logic moves into a unified update pipeline composed of
small internal steps. A possible shape:

- `loadUnifiedUpdateContext()`
- `planDependencyUpdates()`
- `planTemplateSync()`
- `planProvisionReconciliation()`
- `classifyUpdateEntries()`
- `applySafeEntries()`
- `confirmConflictEntries()`
- `applyConfirmedConflicts()`
- `formatUnifiedUpdateSummary()`

This keeps the user-facing command singular while preserving modular internals
and allowing the current `runUpdate()` and `runProvisionRepair()` logic to be
reused or gradually absorbed.

## UX Details

The command should feel like a single guided maintenance action:

```text
Detected Nextion project: my-site
Scanned scaffold version, runtime dependency, Notion resources, and bindings.

Safe updates to apply automatically: 8
Conflicts requiring confirmation: 3

Conflicts:
- code template conflicts: 1
- Notion content conflicts: 1
- Cloudflare binding conflicts: 1
```

If conflicts exist, the command should ask once:

```text
Choose how to proceed:
1. Apply all conflict updates
2. Apply only safe updates
3. Cancel
```

This is intentionally simpler than per-file prompting. The product goal is one
command and one decision point.

## Migration Strategy

### CLI Migration

- keep the public docs and help text centered on `nextion update`
- remove `nextion provision repair` from user-facing upgrade guidance
- update any generated README instructions that currently tell users to choose
  between two maintenance commands

### Implementation Migration

The transition can happen incrementally:

1. keep existing repair logic as an internal helper
2. add unified planning and classification on top
3. switch `nextion update` to invoke the full pipeline
4. delete or hide the old standalone repair entry after tests and docs are in
   place

## Testing Strategy

### Unit Tests

- project detection from `.nextion/scaffold.json`
- dependency bump planning
- scaffold-managed file classification into safe vs conflict
- Notion reconciliation classification into safe vs conflict
- Cloudflare reconciliation classification into safe vs conflict
- legacy compatibility preservation

### Integration Tests

- an existing scaffolded project runs `nextion update` without re-entering
  Notion page information
- a project with only additive drift is upgraded automatically
- a project with local template edits produces grouped conflicts
- a project with populated Site Settings values produces Notion conflicts
- a project missing bindings or data source properties is repaired
  automatically when safe

### Regression Tests

- current `update` behavior for scaffold-managed files does not regress
- current non-interactive provision repair logic is preserved under the unified
  flow
- no deploy is triggered by default

## Success Criteria

- users only need to remember `nextion update`
- existing projects upgrade without repeating initial setup prompts
- safe drift is corrected automatically
- risky changes are never applied silently
- the command summary clearly explains what changed and what remains manual
