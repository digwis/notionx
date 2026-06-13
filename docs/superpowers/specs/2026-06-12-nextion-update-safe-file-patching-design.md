# Nextion Update Safe File Patching Design

## Summary

This design narrows the first meaningful implementation of `nextion update`
from a generic "template sync" idea into a deliberately safe operation:

- regenerate the latest scaffold output from project metadata
- compare only a small allowlist of scaffold-owned files
- replace those files in full when they differ
- never touch user-owned application code

The purpose is to give developers a reliable command for checking the latest
scaffold effect during rapid iteration without rerunning project creation or
triggering Cloudflare / Notion side effects.

## Goals

- Make `nextion update` actually mutate files, not just print a plan.
- Keep the first version safe, predictable, and easy to explain.
- Limit writes to a small set of explicitly scaffold-owned files.
- Preserve the separation between local template sync and external resource
  repair.
- Reuse the new scaffold metadata as the source of truth for re-rendering.

## Non-Goals

- Do not update `app/**`, `components/**`, or other user-facing code in this
  version.
- Do not build partial merge, hunk merge, or three-way merge behavior.
- Do not run `pnpm install` automatically.
- Do not trigger `nextion provision repair`.
- Do not mutate Cloudflare or Notion resources.

## Problem

The current `nextion update` skeleton only loads project metadata and reports a
coarse file plan. It does not yet deliver the practical workflow users want:

- change scaffold templates
- run one command in an existing generated project
- see the latest scaffold-managed base files land in place

Without real file updates, the command does not yet solve the "check the latest
scaffold effect without recreating the project" requirement.

## Recommended Approach

Implement the first real update flow as a full-file replacement system for a
strict allowlist of scaffold-owned files.

Why this approach:

- it is much safer than trying to merge into arbitrary user-edited files
- it gives immediate value for fast scaffold iteration
- it creates a solid base for future expansion into region-based patching

Rejected for first version:

- region patching: useful later, but requires durable markers and merge rules
- general diff/merge: too risky and too complex for the current stage

## User-Facing Behavior

### Command

```bash
nextion update
```

### Expected Flow

1. confirm the current directory is a Nextion-generated project
2. load `.nextion/scaffold.json`
3. render the latest scaffold output into a temporary directory using that
   metadata
4. compare the allowlisted scaffold-owned files
5. replace only the files that changed
6. print a summary of `updated`, `unchanged`, `missing`, and `skipped`

### What It Must Not Do

- no Cloudflare provisioning
- no Notion provisioning
- no deploy
- no install
- no mutation of files outside the allowlist

## File Ownership Boundary

The first version treats only these files as fully scaffold-owned:

- `package.json`
- `wrangler.jsonc`
- `README.md`
- `.nextion/scaffold.json`
- `.dev.vars.example`

Rules:

- if a file is in this list, `nextion update` may replace it in full
- if a file is not in this list, `nextion update` must not modify it
- absence of a file in the current project is not an error; the command may
  create it if the latest scaffold output includes it

This boundary is intentionally small so the command is safe enough to use
frequently during scaffold iteration.

## Data Source

The command uses scaffold metadata as the source of truth:

- project name
- scaffold version metadata
- locale settings
- UI preset
- `@notionx/core` source specifier
- content source id, title, and fields

That metadata is already written into `.nextion/scaffold.json` during project
generation. The update flow should not prompt the user for values interactively.

## Rendering Strategy

`nextion update` should generate the expected current scaffold output in a
temporary directory.

Recommended flow:

1. load project metadata
2. convert metadata into a valid `Answers` object for rendering
3. resolve the same templates directory that the create flow uses
4. render into a temporary directory
5. compare allowlisted files from temp output against the current project

This keeps update behavior tied directly to the real scaffold templates instead
of maintaining a second copy of file content generation logic.

## Comparison Semantics

Each allowlisted file gets one status:

- `updated`: file exists in both places and content differs, so overwrite it
- `unchanged`: file exists in both places and content matches
- `missing`: file is absent in the project but present in the generated output,
  so create it
- `skipped`: file could not be considered for update because it is outside the
  allowlist or absent from the generated output

Notes:

- line-ending normalization is allowed if needed to avoid platform noise
- comparison should be content-based, not timestamp-based
- binary files are out of scope for this first version because the allowlist is
  text-only

## Write Strategy

For `updated` and `missing` statuses:

- write the full file contents from the temporary scaffold output into the
  project
- ensure parent directories exist before writing

For `unchanged`:

- do nothing

For `skipped`:

- do nothing

The command must not partially patch file contents in this version.

## Output Summary

The command should end with a concise summary grouped by status:

- updated files
- missing files created
- unchanged files
- skipped files

Additional rule:

- if `package.json` was updated, print a follow-up hint to run `pnpm install`

This is important because dependency range changes are common scaffold updates,
but automatic install is intentionally out of scope.

## Error Handling

- if `.nextion/scaffold.json` is missing or invalid, fail with a clear
  "not a Nextion project" style message
- if temporary rendering fails, abort without modifying project files
- if writing one file fails, surface the file path in the error
- if a file is outside the allowlist, never write it even if the temporary
  output differs

## Architecture

Recommended responsibilities:

- `project-context.ts`
  - load and validate project metadata
- `provision/repair.ts`
  - unrelated to this change; remains separate
- `update/scaffold-files.ts`
  - define the allowlist
- `update/template-sync.ts`
  - render to temp dir, compare files, and produce actionable results
- `update/index.ts`
  - orchestrate update execution and summary output
- `cli-nextion.ts`
  - dispatch the command

This keeps update logic isolated from create and repair logic.

## Testing

Add focused tests for:

- loading metadata and generating render inputs for update
- rendering to a temp directory and reading allowlisted files
- overwriting changed scaffold-owned files
- creating missing scaffold-owned files
- leaving unchanged files untouched
- never modifying files outside the allowlist
- printing the `pnpm install` hint when `package.json` changes

## Risks

- if metadata stops matching the true scaffold shape, update may render the
  wrong expected output
- if users manually edit allowlisted files, those edits will be overwritten by
  design; documentation must make that ownership rule explicit
- if the allowlist is too small, users may expect more changes than the command
  applies

## Rollout

Implement this as the next step for `nextion update`, then document the command
as:

- safe for repeated use
- limited to scaffold-owned files
- separate from `nextion provision repair`

Future expansions can add:

- larger allowlists
- region-based updates
- explicit `--dry-run`
- explicit `--install`

## Validation

Validate with these workflows:

- generate a project, change scaffold-owned template files, run `nextion update`,
  confirm only allowlisted files change
- rerun `nextion update` immediately, confirm all files report `unchanged`
- manually edit a non-allowlisted file, run `nextion update`, confirm it is not
  touched
- update `package.json.tmpl`, run `nextion update`, confirm the file updates and
  the summary recommends `pnpm install`
