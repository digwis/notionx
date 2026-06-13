# Release Check Scripts Design

## Summary

This design adds a small set of release-check scripts to the root
`package.json` so the repo can run fast pre-publish validation during the
current high-churn phase.

The design intentionally avoids new script files or deeper automation. It only
adds root package scripts that compose existing package commands.

## Goals

- Provide a single root command for the minimum release checks.
- Provide package-scoped commands for the packages that are actively published.
- Match the existing root script naming style.
- Keep the change limited to the root `package.json`.

## Non-Goals

- Do not add a new `scripts/` file.
- Do not add release automation beyond preflight checks.
- Do not validate npm registry state or GitHub Actions state in this step.

## Proposed Scripts

Add the following scripts to the root `package.json`:

- `release:check`
  - runs `pnpm -r typecheck`
  - runs `pnpm -r lint`
  - runs `pnpm changeset status --help`

- `release:check:core`
  - runs `pnpm --filter @notionx/core typecheck`
  - runs `pnpm --filter @notionx/core lint`

- `release:check:create`
  - runs `pnpm --filter @notionx/create-nextion-app test`

- `release:check:skill`
  - runs `pnpm --filter @notionx/skill typecheck`
  - runs `pnpm --filter @notionx/skill lint`

## Rationale

`release:check` gives a single top-level command for "I want the minimum
confidence before I push to `main`". The package-scoped variants keep the fast
path available when only one package changed.

`@notionx/create-nextion-app` currently has `test` but no repo-standard root
lint/typecheck hooks exposed in the same way as the other published packages, so
the first version keeps its package-specific check to the command the package
already guarantees.

## Acceptance Criteria

- Root `package.json` contains the four new `release:check*` scripts.
- Each script only composes existing commands.
- No new files are created outside the spec itself.
