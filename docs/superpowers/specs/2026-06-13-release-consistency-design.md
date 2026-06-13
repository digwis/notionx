# Release Consistency Design

## Summary

This design fixes the monorepo release flow so GitHub `main` remains the source
of truth for every npm publish.

Today, the workflow can publish to npm before the matching version commit is
successfully pushed back to GitHub. That failure mode explains the current
state: npm has newer package versions than the repository's `main` branch, and
`packages/nextion-skill` is not yet visible on GitHub `main`.

The design keeps Changesets and automatic npm publishing, but changes the
release sequence to:

1. version packages on `main`
2. commit and push the versioned state back to GitHub
3. publish npm packages only after the push succeeds

The design also fixes the supporting configuration needed for reliable package
selection and workflow triggering.

## Goals

- Ensure npm is never ahead of GitHub `main` for the same release.
- Keep the existing Changesets-based release model.
- Make `@notionx/skill` participate in the same automatic release flow as the
  other published packages.
- Remove package-name mismatches that prevent Changesets from targeting the
  intended packages.
- Keep the implementation focused on release reliability, not broader repo
  refactoring.

## Non-Goals

- Do not redesign the monorepo structure.
- Do not replace Changesets with a completely different release system.
- Do not add prerelease, canary, or multi-channel publishing in this change.
- Do not change package runtime behavior beyond what is required for release
  correctness.

## Problem

The current workflow uses a one-shot `changesets/action` step that versions and
publishes packages in the same run, then pushes the version commit afterward.
That ordering is risky:

- npm publish may succeed
- the later `git push origin HEAD:main` may fail
- the repository is left behind while npm already exposes the new release

The current configuration also has several support issues:

- `packages/nextion-skill/**` is not included in the release workflow trigger
- some changeset files still reference old package names
- the root workspace does not explicitly provide `@changesets/cli`
- the workflow only builds two packages explicitly, leaving the skill package
  less obvious in the release pipeline

## Current State

The observed mismatch is:

- GitHub `main` still shows older package versions for
  `@notionx/core` and `@notionx/create-nextion-app`
- GitHub `main` does not yet contain `packages/nextion-skill`
- npm already exposes:
  - `@notionx/core@0.1.3`
  - `@notionx/create-nextion-app@0.4.10`
  - `@notionx/skill@0.1.0`

This is consistent with a publish-first, push-later workflow failure mode.

## Proposed Changes

## Release Ordering

The release workflow should be updated to run in this order:

1. install dependencies
2. build the releasable packages
3. run `pnpm changeset version`
4. commit the resulting version changes on the checked-out `main`
5. push that commit back to `origin/main`
6. publish packages to npm from the pushed versioned state

The critical rule is:

- if the push to GitHub fails, the workflow must stop before npm publish

This makes GitHub `main` the publication checkpoint instead of a best-effort
cleanup step after publish.

## Workflow Trigger Coverage

The release workflow trigger should include:

- `packages/nextion/**`
- `packages/create-nextion-app/**`
- `packages/nextion-skill/**`
- `.changeset/**`
- `.github/workflows/release.yml`

This ensures source-only changes in the skill package can trigger the release
workflow when accompanied by a valid changeset.

## Changesets Package Identity

All changeset frontmatter entries must use the real package names from each
package's `package.json`.

The canonical names are:

- `@notionx/core`
- `@notionx/create-nextion-app`
- `@notionx/skill`

Files that still reference old names such as `@nextion/core`,
`create-nextion-app`, or `nextion-skill` must be updated.

## Root Tooling

The root workspace should declare `@changesets/cli` in `devDependencies`.

This avoids relying on transient local state or undeclared tooling when the
workflow runs `pnpm changeset version`.

## Explicit Build Coverage

The release workflow should explicitly build all published packages before the
versioning and publish steps:

- `@notionx/core`
- `@notionx/create-nextion-app`
- `@notionx/skill`

This makes the release pipeline easier to reason about and keeps package
preparation symmetric across the repo.

## Recommended Workflow Shape

Recommended first implementation:

- keep one workflow file
- replace the publish-first `changesets/action` usage with explicit steps
- version, commit, and push before publish
- publish with `pnpm -r publish --no-git-checks --tag latest`

This is the smallest change that fixes the current consistency bug.

Two-job orchestration is acceptable later, but it is not required for the first
repair.

## Failure Handling

The workflow should fail fast in these situations:

- `pnpm changeset version` fails
- the version commit cannot be created
- the push to `origin/main` fails
- package build fails
- npm publish fails

Expected outcome by phase:

- before push: nothing new is published
- after push but before publish: GitHub is ahead of npm temporarily, which is
  acceptable and recoverable
- after successful publish: GitHub and npm match

The design intentionally prefers "GitHub ahead of npm for a short time" over
"npm ahead of GitHub", because the former preserves source-of-truth integrity.

## Testing And Verification

The implementation should be verified with these checks:

- confirm the workflow syntax remains valid
- confirm the trigger includes `packages/nextion-skill/**`
- confirm all pending changeset files use canonical package names
- confirm `pnpm changeset version` is available from the root workspace
- dry-run the logic mentally against the failure case:
  - push failure must block publish
- after the next real release:
  - GitHub `main` package versions match npm `latest`
  - GitHub `main` contains `packages/nextion-skill`

## Risks

- If package-name mismatches remain in hidden or future changeset files, some
  intended releases may still be skipped.
- If branch protection blocks workflow pushes to `main`, the workflow will now
  fail earlier. That is correct behavior, but it must be compatible with repo
  rules.
- If publish happens after push and then fails, GitHub may temporarily contain a
  version bump that npm does not yet expose. This is safer than the reverse and
  can be resolved with a rerun.

## Rollout

The change should be implemented in this order:

1. fix changeset package names
2. add `@changesets/cli` to the root workspace
3. update `release.yml` trigger coverage and ordering
4. verify the updated workflow configuration
5. use the next real release to confirm GitHub and npm stay aligned

## Acceptance Criteria

- A release cannot reach npm unless the matching version commit has already been
  pushed to GitHub `main`.
- `@notionx/skill` is covered by the same release workflow as the other
  published packages.
- Pending changesets target the real package names.
- The root workspace provides the tooling needed for `pnpm changeset version`.
- The next successful release leaves GitHub `main` and npm on the same version
  set.
