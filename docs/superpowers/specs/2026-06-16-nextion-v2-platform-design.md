# Nextion v2 Platform Design

## Summary

This design repositions `Nextion` from a Notion-powered Next.js starter into a
developer-first platform for generating, extending, and upgrading Notion-native
sites on Cloudflare.

The product is not defined by `Next.js` itself. Its real value is:

- generating a deployable project from a site intent such as `blog` or `docs`
- giving the user source-code ownership of most business-facing files
- preserving a platform-managed layer that can still be upgraded safely
- treating Notion as a primary content source, not the platform's domain model

The ideal end state is a platform that combines:

- `shadcn/ui` style code ownership
- `Astro` style `add` workflows
- `Prisma` style internal model consistency
- `Angular CLI` style upgrade and migration support

## Design Goals

- Make `Nextion` feel like a product platform, not a framework package with a
  scaffolder attached.
- Make `create`, `add`, and `upgrade` the primary user journey.
- Optimize for developers who want generated source code they can inspect and
  modify.
- Lead with site-type generation such as `blog`, `docs`, and `changelog`
  instead of exposing schema-first complexity as the main entrypoint.
- Preserve enough machine-readable metadata for safe upgrades after users have
  customized their project.
- Separate runtime concerns, template concerns, and upgrade concerns into
  independent platform layers.

## Non-Goals

- Do not optimize primarily for no-code or content-team-only workflows.
- Do not make raw Next.js or React internals the main product abstraction.
- Do not require users to understand the internal content model system before
  creating a site.
- Do not promise that every generated file can be overwritten automatically in
  future upgrades.
- Do not treat Notion database structure as the canonical platform domain model.

## Product Positioning

### One-Sentence Positioning

`Nextion` is a developer-first platform for generating and evolving
Notion-native websites on Cloudflare.

### User Mental Model

Users should understand `Nextion` as:

- a CLI platform
- a library of installable site templates and feature modules
- a runtime engine behind the scenes
- an upgrade system that respects ownership boundaries

Users should not primarily understand `Nextion` as:

- a starter repo
- a thin wrapper around Next.js
- a single runtime package

### Primary User

The primary user is a developer who wants:

- fast project generation
- editable source code
- a repeatable content-driven site architecture
- a supported path for upgrades over time

## Strategic Direction

Three product directions were considered:

1. framework-package-first
2. content-model-first
3. site-platform-first

This design recommends the third direction: `site-platform-first`.

Reasons:

- it matches the desired user-facing commands such as `nextion add blog`
- it creates a stronger product identity than a generic framework package
- it supports fast market entry through recognizable site types
- it still allows content models to exist as an internal system abstraction

## Core Product Principles

### CLI First

The primary product surface is the CLI, not the runtime package.

### Site Type First

The first abstraction users see is the site type:

- `blog`
- `docs`
- `changelog`
- `landing`
- `wiki`
- `portfolio`

### Developer Ownership

Generated business-facing code belongs to the user by default.

### Managed Upgradeability

The platform keeps structured control of a smaller managed layer so it can
still upgrade projects safely.

### Internal Models, External Simplicity

The platform may use content models internally, but should not force users into
schema-first workflows as the main product path.

## Platform Architecture

`Nextion v2` is organized as a four-layer platform.

### Layer 1: Runtime

The runtime is the engine layer. It is responsible for:

- Notion content access and caching
- Cloudflare Workers runtime integration
- auth, media, storage, webhook, and search primitives
- rendering and SEO primitives
- content querying and fetch contracts

This layer corresponds to the current `@notionx/core` direction, but in the
ideal product model it is no longer the main user-facing identity.

### Layer 2: Templates

Templates are the platform's product layer. A template is not a plain file
folder. It is an installable site capability unit such as:

- `blog`
- `docs`
- `changelog`
- `landing`

Each template defines:

- files to generate
- dependencies to install
- config to inject
- registries to update
- ownership boundaries
- upgrade metadata

### Layer 3: CLI

The CLI is the only primary user entrypoint. It is responsible for:

- project creation
- template and module installation
- project inspection
- upgrade planning and execution
- doctor and diff workflows

### Layer 4: Generated Project

The generated project is what the user owns and deploys. It contains:

- user-owned pages and components
- managed configuration and glue layers
- project metadata for future upgrades
- bindings to the runtime and installed templates

## Ideal Package Structure

The monorepo should eventually be organized by platform responsibility rather
than by historical implementation shape.

```text
packages/
  nextion-cli/
  nextion-runtime/
  nextion-upgrader/
  nextion-template-sdk/
  nextion-template-blog/
  nextion-template-docs/
  nextion-template-changelog/
  nextion-module-search/
  nextion-module-analytics/
  create-nextion/

examples/
  blog/
  docs/
  changelog/

docs/
  architecture/
  templates/
  upgrade/
```

### Package Responsibilities

#### `@notionx/cli`

Public command surface:

- `create`
- `add`
- `upgrade`
- `diff`
- `doctor`
- `info`

#### `@notionx/runtime`

Engine responsibilities:

- Notion adapter
- Cloudflare runtime integration
- auth, cache, SEO, media, storage, webhook
- worker bootstrap and page rendering primitives

#### `@notionx/upgrader`

Migration responsibilities:

- inspect project state
- resolve target versions
- plan upgrade actions
- apply safe changes
- surface conflicts and manual steps

#### `@notionx/template-sdk`

Template contract responsibilities:

- template manifest definitions
- ownership declarations
- install hooks and prompt contracts
- registry update contracts
- migration declarations

#### `@notionx/template-*`

Official site-type product units such as:

- `@notionx/template-blog`
- `@notionx/template-docs`
- `@notionx/template-changelog`

#### `@notionx/module-*`

Cross-cutting capability units such as:

- `search`
- `analytics`
- `comments`
- `rss`
- `sitemap`

#### `create-nextion`

Compatibility shim for `npm create nextion`. Real creation logic should defer to
the CLI instead of duplicating separate scaffolder behavior.

## Command Model

The long-term public command system should focus on five families of commands.

### Create

```bash
pnpm create nextion
```

Responsibilities:

- initialize project skeleton
- choose the first site type
- connect Notion
- configure Cloudflare basics
- write project metadata
- install the first template

### Add

```bash
nextion add blog
nextion add docs
nextion add changelog
nextion add search
nextion add analytics
```

`add` supports two product categories under one user-facing verb:

- site templates
- feature modules

### Upgrade

```bash
nextion upgrade
```

Responsibilities:

- upgrade runtime dependencies
- upgrade installed templates and modules
- apply managed changes
- inspect config drift
- inspect content mapping drift
- present safe changes and conflicts clearly

### Diff

```bash
nextion diff
nextion diff --template blog
nextion diff --upgrade
```

Responsibilities:

- show what is installed
- show managed ownership boundaries
- preview upcoming upgrade effects
- reduce fear and uncertainty before changes are applied

### Doctor

```bash
nextion doctor
```

Responsibilities:

- validate Notion access
- validate Cloudflare bindings
- validate project metadata
- validate template installation state
- surface compatibility problems

## Ownership Model

`Nextion v2` should use three ownership classes, not a simplistic official vs
user split.

### 1. User-Owned Files

These files belong to the user after generation. Typical examples:

- `app/(site)/**`
- `components/**`
- `styles/**`
- `lib/content/**`
- `lib/site/**`
- business pages and presentation components

Rules:

- upgrades do not overwrite them by default
- the platform may offer diffs or suggestions
- users may customize them freely

### 2. Platform-Managed Files

These files are controlled by `Nextion` for long-term maintainability. Typical
examples:

- `nextion.config.ts`
- `.nextion/project.json`
- `.nextion/installations.json`
- `.nextion/managed-files.json`
- managed sections of `package.json`
- managed sections of `wrangler.jsonc`

Rules:

- upgrades may modify them automatically
- users should not treat them as freeform business code
- they act as upgrade anchors

### 3. Bridge Files

These files connect platform structure to user code. Typical examples:

- `worker/index.ts`
- content registries
- site feature registries
- platform route aggregators

Rules:

- the platform owns the file skeleton
- the user extends via explicit slots or extension points
- the platform upgrades the skeleton without rewriting user extensions

### Ownership Principle

The product rule is:

`Nextion generates business code for the user to own, and keeps the platform
skeleton for itself to upgrade.`

## Template System

Templates must be installable units with machine-readable contracts, not static
folders copied blindly.

Each template should define at least:

- name
- version
- category
- dependencies
- prompts
- generated files
- managed files
- user-owned files
- registry mutations
- migrations

Illustrative shape:

```ts
defineTemplate({
  name: "blog",
  version: "2.0.0",
  kind: "site-template",
  requires: ["search"],
  prompts: [...],
  files: [...],
  managedFiles: [...],
  userOwnedFiles: [...],
  registries: [...],
  migrations: [...],
})
```

### Example: `blog`

`nextion add blog` should install a coherent site capability, not just a
database binding. It should generate:

- blog listing page
- blog detail page
- content source binding
- list and card components
- SEO defaults
- optional RSS and sitemap integration
- template installation metadata

This same structure applies to `docs`, `changelog`, and `landing`.

## Content Model Strategy

The product should be site-type-first externally and content-model-driven
internally.

### External Product Layer

Users first think in site types:

- `blog`
- `docs`
- `changelog`

### Internal System Layer

The platform internally thinks in content models such as:

- `article`
- `doc-page`
- `release-note`
- `project`
- `landing-page`
- `page-block`

This allows reusable system logic across templates.

### Why This Split Matters

Without an internal model layer:

- field mapping logic is duplicated
- search and SEO reuse is fragmented
- template evolution becomes ad hoc
- upgrade systems cannot tell whether a change is model-level or template-level

## Notion's Role

Notion should be treated as a source adapter, not as the platform's canonical
domain model.

The preferred relationship is:

```text
Nextion Content Model
  -> Notion Source Mapping
  -> Query Layer
  -> Page Generation
```

This means:

- platform semantics such as `article.title` are stable
- Notion field names remain user-configurable
- template and runtime logic are not polluted by raw Notion naming

### Model Binding

Projects should store explicit source mappings. Illustrative shape:

```ts
export const blogModel = defineModelBinding({
  model: "article",
  source: "notion",
  databaseId: "...",
  fields: {
    title: "Title",
    slug: "Slug",
    description: "Description",
    publishedAt: "Published At",
    tags: "Tags",
  },
})
```

## Upgrade System

The upgrade system is a core product capability. Without it, `Nextion` becomes
another one-shot starter generator.

### Upgrade Promise

The system should promise four things:

- upgrade the platform runtime
- upgrade the managed layer
- detect user-layer conflicts
- produce a clear migration plan

It should not promise full automatic convergence of every customized file.

### Upgrade Pipeline

`nextion upgrade` should execute as a structured pipeline:

1. inspect project state
2. resolve target versions and migrations
3. plan changes
4. apply safe changes
5. review conflicts
6. finalize with a summary

### Change Classification

Every change should be classified as:

- `safe`
- `review`
- `conflict`
- `manual`

This classification is the basis of product trust.

### Upgrade Targets

The upgrade engine manages three kinds of upgrade targets:

1. runtime
2. template
3. source binding

### Migration Protocol

Upgrade logic should be declared through migration objects, not scattered patch
scripts. Illustrative shape:

```ts
defineMigration({
  id: "blog-2.2-to-2.3",
  from: "2.2.0",
  to: "2.3.0",
  kind: "template",
  steps: [
    addManagedFile(...),
    updateRegistry(...),
    suggestCodemod(...),
    requireManualReview(...),
  ],
})
```

### Project Metadata

Each generated project should maintain a metadata directory:

```text
.nextion/
  project.json
  installations.json
  managed-files.json
  migrations/
  snapshots/
```

Responsibilities:

- `project.json`: project version and baseline identity
- `installations.json`: installed templates and modules plus versions and params
- `managed-files.json`: ownership declarations
- `migrations/`: applied migration history
- `snapshots/`: prior generated state used for diff and conflict detection

### Notion Upgrade Rules

Safe actions:

- add missing fields
- add empty defaults
- create missing managed entries
- add non-destructive helper properties

Conflict or manual-only actions:

- rename populated fields
- rewrite filled site settings
- rewrite existing page copy
- reorder user-authored content structure

### Upgrade Principle

The product rule is:

`Nextion automatically upgrades the parts it owns and clearly explains the
parts it does not own.`

## Mapping From The Current Repository

The existing repository already contains the rough outline of this end state,
but responsibilities are still grouped around historical package boundaries.

### Current `packages/nextion`

Recommended target role:

- evolve into `@notionx/runtime`

Reason:

- it already contains runtime primitives, Notion integration, auth, worker
  bootstrap, cache, admin, and content logic

### Current `packages/create-nextion-app`

Recommended target role:

- split toward `@notionx/cli`
- split toward `@notionx/upgrader`

Reason:

- it currently mixes project creation, template rendering, provisioning,
  updating, and repair concerns

### Current `packages/create-nextion-app-shim`

Recommended target role:

- become `create-nextion`

Reason:

- it should remain a compatibility shim for `npm create` behavior

### Current template directory inside the scaffolder

Recommended target role:

- migrate toward protocol-based templates
- become installable template packages or a template registry

## Phased Roadmap

The transition should happen incrementally rather than as a single rewrite.

### Phase 1: Product Boundary Reset

Goals:

- make CLI the product surface
- clarify that runtime is the engine, not the whole product
- rewrite documentation around platform language

### Phase 2: Template Protocol

Goals:

- introduce template manifests
- introduce ownership tracking
- introduce `.nextion/*` installation records
- make `blog` the first protocol-based template

This phase is the most important architectural pivot.

### Phase 3: Upgrade Engine Extraction

Goals:

- separate a real upgrader module
- introduce migration objects
- introduce structured `diff --upgrade`
- classify changes as safe, review, conflict, and manual

This phase creates the long-term platform moat.

### Phase 4: Template And Module Ecosystem

Goals:

- ship official `blog`, `docs`, `changelog`, and `landing` templates
- ship cross-cutting modules such as `search`, `analytics`, and `comments`
- allow templates to depend on modules
- allow one project to compose multiple installed capabilities

## Priority Recommendations

If only one architectural move can be prioritized, it should be template
protocolization.

Priority order:

1. template protocol and ownership tracking
2. project metadata and diff foundations
3. CLI productization
4. internal content model convergence

Reasons:

- template protocolization enables `add`
- template protocolization gives `upgrade` reliable anchors
- metadata makes future doctor, diff, codemod, and migration work more reliable
- CLI productization improves user mental model immediately
- internal content models matter, but they can remain an internal convergence
  track at first

## Success Criteria

- users experience `Nextion` as a CLI platform rather than a starter repo
- site-type installation becomes a first-class workflow
- generated business code remains largely user-owned
- upgrades become structured, explainable, and conflict-aware
- runtime, template, and upgrader responsibilities are clearly separated
- the project can evolve toward multiple official templates without turning into
  copy-pasted starters

## Final Conclusion

`Nextion` should not evolve primarily as a Notion-flavored Next.js starter. Its
ideal end state is a developer-first platform generator for Notion-native sites.

Its long-term structure should be:

- CLI as the product entrypoint
- templates as the product surface
- runtime as the engine
- upgrader as the continuity system
- generated projects as user-owned deliverables with managed platform anchors

This design gives `Nextion` a more durable identity than framework-level
optimization work alone. It focuses the product on its real differentiation:

- project generation
- template installation
- content-driven site composition
- safe ongoing upgrades
