---
"@notionx/create-nextion-app": patch
---

Fix two scaffolder follow-up bugs that the previous patch release
surfaced when trying to apply its fix to an already-scaffolded
project.

- **Generated projects now ship the scaffolder CLI as a
  devDependency.** Previously `templates/package.json.tmpl` only
  listed `@notionx/core` under `dependencies`; `nextion` and
  `create-nextion-app` were nowhere, so `pnpm exec nextion update`
  inside a scaffolded project failed with
  `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "nextion" not found`.
  The CLI is now declared as a devDependency at the same version
  as `@notionx/core`, so `pnpm exec nextion {update,provision
  repair}` works out of the box on every fresh scaffold.

- **Release workflow's auto-version-bump push no longer fails the
  pre-push changeset check.** `pnpm changeset version` produces a
  `chore(release): version packages` commit that legitimately
  modifies `package.json` and consumes `.changeset/*.md`; the
  `husky` pre-push hook was running `pnpm release:status` against
  that commit and rejecting the push with "code changed without a
  changeset" — a circular dependency that silently blocked every
  release. The workflow's push now uses `git push --no-verify`,
  scoped to the auto-bump step, with an inline comment explaining
  why the human-only check must not fire on bot-driven bumps.

A new render test asserts the rendered `package.json` includes
`@notionx/create-nextion-app` in `devDependencies` and that its
version is a real semver aligned with the `@notionx/core` runtime
dependency.
