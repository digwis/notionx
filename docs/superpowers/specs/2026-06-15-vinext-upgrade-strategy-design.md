# Vinext Upgrade Strategy Design

## Context

`nextion` is now a framework monorepo rather than a deployable app repository.
Generated consumer projects such as `digwis` own their own dependency graph,
deployment lifecycle, and Cloudflare bindings after scaffolding completes.

At the moment:

- the scaffolder template still recommends `vinext: ^0.1.0` and
  `@vinext/cloudflare: ^0.1.0`
- npm currently publishes `vinext@0.1.3` and `@vinext/cloudflare@0.1.2`
- `digwis` is already running inside that compatible semver line

The key product question is whether this upgrade should be treated as:

1. a consumer-project dependency bump that projects can perform directly, or
2. a framework-level migration that must wait for a new `nextion` release and
   then flow through `npx nextion update`

## Decision

Treat this specific `vinext` upgrade as a **compatible dependency upgrade**,
not a scaffold migration.

That means:

- existing projects such as `digwis` should upgrade `vinext` and
  `@vinext/cloudflare` directly first
- `digwis` acts as the canary project for real-world verification
- only after that verification passes should the scaffolder template's
  recommended versions be updated
- `npx nextion update` is **not** expanded for this change because there is no
  evidence yet that a template/config/runtime migration is required

## Why

This keeps the boundaries clean:

- npm dependencies remain normal npm dependencies
- `nextion update` remains responsible for scaffold-managed files, framework
  alignment, and cloud-resource drift
- a simple compatible `vinext` bump does not force every consumer project
  through a project-structure migration workflow

If the canary reveals required template/config changes, the strategy can be
escalated later into a formal scaffold upgrade. Until then, the lowest-risk path
is to verify the dependency bump in a real project first.

## Scope

### In Scope

- upgrade `digwis` to `vinext@0.1.3` and `@vinext/cloudflare@0.1.2`
- run `typecheck`, `test`, and `build` in `digwis`
- if all checks pass, update the scaffolder template to recommend the newer
  versions

### Out of Scope

- changing `nextion update` behavior
- changing generated project structure
- changing Cloudflare bindings or Notion provisioning logic
- performing a major dependency refresh across unrelated packages

## Success Criteria

- `digwis` upgrades cleanly and passes local verification
- the scaffolder template reflects the validated `vinext` baseline
- no new migration step is introduced for existing consumer projects
- the result stays consistent with the product rule:
  - compatible infra dependency bumps can be applied directly in consumer apps
  - scaffold/config migrations require a released `nextion` update path
