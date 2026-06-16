# Nextion Add Docs And Search Design

## Summary

This spec defines the first real `nextion add` installation flow for `Nextion v2`.

The goal is not to deliver a full production-grade docs system. The goal is to
prove that a generated project can install a new site template and a new feature
module after scaffold time, while preserving the ownership model introduced in
the earlier protocol work.

The concrete milestone is:

- start from an existing blog-based project
- run `nextion add docs`
- get a working `/docs` subsystem
- run `nextion add search`
- get a docs-scoped search capability
- keep the existing blog routes intact

This creates the first end-to-end proof that `Nextion` is becoming a platform
installer rather than a one-shot starter.

## Goals

- Add a real `nextion add docs` command that installs a minimal docs subsystem
  into an existing project.
- Add a real `nextion add search` command that installs a minimal search module
  scoped to docs content.
- Keep `blog`, `docs`, and `search` in one project at the same time.
- Reuse the existing protocol metadata:
  - `.nextion/installations.json`
  - `.nextion/managed-files.json`
- Reuse the ownership model:
  - platform-managed
  - bridge
  - user-owned
- Make the add flow produce a machine-readable install plan before writing files.
- Keep the design small enough to implement inside the current
  `packages/create-nextion-app` package.

## Non-Goals

- Do not build a fully featured docs product in this phase.
- Do not implement global site search.
- Do not rewrite the default blog home page or blog routes.
- Do not introduce migration objects yet.
- Do not solve arbitrary multi-template composition rules beyond the first
  `blog + docs + search` combination.
- Do not extract a separate `@notionx/cli` or `@notionx/upgrader` package yet.

## Product Decision

This phase adopts the `coexistence` model.

That means:

- `blog` stays in place
- `docs` is added as a new subsystem under `/docs`
- `search` is added as a docs-scoped module
- nothing in the existing blog experience is replaced

This is the strongest proof that the platform can add new capabilities to an
existing project over time.

## User Experience

### Command Flow

The phase introduces these commands:

```bash
nextion add docs
nextion add search
```

The expected user journey is:

1. scaffold a default project
2. run `nextion add docs`
3. review created files and metadata changes
4. run `nextion add search`
5. verify docs pages now expose a search entrypoint

### Output Expectations

Both commands should produce a structured summary grouped by action type:

- files created
- files patched
- metadata updated
- follow-up actions
- review items
- conflicts

This keeps the `add` experience aligned with the same explainability goals as
`diff` and `update`.

## Architecture

The design introduces a small install engine inside the current scaffolder
package. It should not be a second rendering path with ad hoc file writes.

Instead, the flow should be:

1. load project context
2. resolve the requested install target
3. build an install plan
4. classify plan entries by ownership and conflict risk
5. apply safe writes and patches
6. print a summary

The install plan is the write-path equivalent of the upgrade diff plan.

## Install Target Model

This phase uses one installation system for both site templates and modules.

### Site Template

`docs` is modeled as:

```ts
{
  name: "docs",
  kind: "site-template",
  version: 1,
  params: {
    basePath: "/docs",
    contentSourceId: "docs",
  },
}
```

### Feature Module

`search` is modeled as:

```ts
{
  name: "search",
  kind: "feature-module",
  version: 1,
  params: {
    scope: "docs",
  },
}
```

The CLI should use the same registry-style resolution path for both targets.

## Install Plan Shape

The install engine should build a plan with four categories:

```ts
interface InstallPlan {
  writeFiles: Array<{
    filePath: string;
    content: string;
    ownership: "platformManaged" | "bridge" | "userOwned";
  }>;
  patchFiles: Array<{
    filePath: string;
    patchKind: "registry" | "config" | "ui-slot";
    ownership: "platformManaged" | "bridge";
  }>;
  updateMetadata: Array<{
    filePath: string;
    reason: "installations" | "managed-files";
  }>;
  postActions: Array<{
    kind: "install-deps" | "manual-review";
    label: string;
  }>;
}
```

This does not need to be the final public type, but the implementation should
follow this separation.

## Docs Template

### What `add docs` Installs

The first version of `docs` should install:

- `app/docs/page.tsx`
- `app/docs/[slug]/page.tsx`
- `components/docs/docs-sidebar.tsx`
- `components/docs/docs-page.tsx`
- `lib/content/docs-source.ts`

These are user-owned files because they represent business-facing template code
that developers are expected to customize later.

### Docs Routing

The docs template must live under `/docs`.

This preserves the current blog routes and avoids replacing the site root. It
also makes the coexistence model obvious in both the codebase and the browser.

### Docs Experience

The phase only requires a minimal docs experience:

- docs index page
- docs detail page
- basic sidebar or local navigation shell
- content binding placeholder for docs content

It does not need:

- full tree navigation authoring
- previous/next pagination
- complex docs information architecture

## Search Module

### What `add search` Installs

The first version of `search` should install:

- `components/search/search-trigger.tsx`
- `lib/search/docs-search.ts`

It may also install:

- `app/api/search/route.ts`

if a dedicated route is the cleanest way to expose docs search in the current
architecture.

### Search Scope

Search is explicitly docs-scoped in this phase.

That means:

- it only indexes docs content
- it only needs to appear in docs-related UI
- it does not need to search blog posts

This keeps the first module installation focused while still proving the module
composition system.

## Bridge And Registry Design

The add flow should not hardcode docs and search directly into unrelated pages.

This phase should add or evolve two bridge-style registries:

- `lib/nextion/content-registry.ts`
- `lib/nextion/site-features.ts`

Illustrative shape:

```ts
export const contentRegistry = {
  blog: createBlogContentSource(),
  docs: createDocsContentSource(),
};

export const siteFeatures = {
  search: {
    scope: ["docs"],
  },
};
```

These bridge files should remain platform-controlled skeletons with explicit
slots for extension.

The rest of the application should consume registry outputs rather than asking
ad hoc questions like "is docs installed?" in many places.

## Metadata Changes

### Installations

Running `nextion add docs` should append a template record to
`.nextion/installations.json`.

Running `nextion add search` should append a module record to the same file.

After both commands, the project should reflect:

- template: `blog`
- template: `docs`
- module: `search`

### Managed Files

Running either add command should also extend `.nextion/managed-files.json`.

The file should record:

- new platform-managed files
- new bridge files
- new user-owned files

This is required so that later `diff` and `update` commands understand what the
platform owns after installation.

## Ownership Rules

The add flow must honor the existing ownership model.

### Platform-Managed

- may be created automatically
- may be patched automatically
- examples:
  - `.nextion/installations.json`
  - `.nextion/managed-files.json`
  - managed sections of `package.json`

### Bridge

- may be created automatically
- may be patched automatically when only platform-owned sections are touched
- should become `review` if local user edits overlap the same extension area

### User-Owned

- may be created automatically when absent
- must not be overwritten when already present
- should become `conflict` if the target file already exists

This keeps `add` consistent with the broader platform philosophy:

`Nextion writes what it owns, and stops clearly when it reaches what the user owns.`

## Conflict Policy

The install engine should classify outcomes as:

- `applied`
- `review`
- `conflict`

### Applied

- new files created safely
- registry patch applied safely
- metadata updated safely

### Review

- a bridge file was locally customized near an insertion point
- a config patch may be valid but should be inspected

### Conflict

- a user-owned target file already exists
- the target path is incompatible with the install plan

The first implementation does not need an interactive patch resolver. It only
needs clear reporting and safe refusal to overwrite user-owned code.

## File Strategy

### Files Created By `add docs`

User-owned:

- `app/docs/page.tsx`
- `app/docs/[slug]/page.tsx`
- `components/docs/docs-sidebar.tsx`
- `components/docs/docs-page.tsx`
- `lib/content/docs-source.ts`

Bridge:

- `lib/nextion/content-registry.ts` if absent
- patch `lib/nextion/content-registry.ts` if present

Potential bridge/UI slot:

- patch `components/site/site-header.tsx` to expose a docs navigation link only
  if the current codebase has a stable insertion point

### Files Created By `add search`

User-owned or user-facing:

- `components/search/search-trigger.tsx`
- `lib/search/docs-search.ts`

Platform-managed or bridge:

- patch `lib/nextion/site-features.ts`
- patch a docs page shell or docs sidebar to expose the search trigger
- add a minimal API route if required by the current search implementation

## Dependency Handling

If docs or search require additional dependencies, the install plan should
record a post-action instructing the user to run `pnpm install`.

The first version does not need automatic dependency installation, but it should
update managed dependency declarations if that is already consistent with the
existing scaffolder behavior.

## Testing Strategy

Testing should cover three levels.

### Unit

- template and module registry resolution
- install plan generation
- ownership classification for add operations
- metadata merge behavior

### Integration

- add docs into an existing scaffolded project
- add search after docs
- verify generated files exist
- verify metadata reflects `blog + docs + search`

### CLI

- `nextion add docs`
- `nextion add search`
- output summaries
- conflict and review reporting

## Success Criteria

This phase is successful when:

- `nextion add docs` creates a usable `/docs` subsystem in an existing blog
  project
- `nextion add search` adds a docs-scoped search entrypoint
- the existing blog pages remain untouched
- `.nextion/installations.json` records all installed capabilities
- `.nextion/managed-files.json` records the new ownership boundaries
- `nextion diff` shows the new template and module
- `nextion diff --upgrade` can preview future changes using the expanded
  metadata

## Out Of Scope Follow-Ups

The following should be deferred to later work:

- complete docs navigation product
- global unified search
- template uninstall
- template migration objects
- priority rules for many installed templates
- module dependency graphs

## Conclusion

`add docs + add search` is the smallest meaningful write-path milestone for the
Nextion platform direction.

It proves:

- templates can be added after scaffold time
- modules can be added after scaffold time
- one project can host multiple installed capabilities
- the ownership model remains intact on the write path

That makes it the right next step after protocol metadata, `diff`, and upgrade
preview foundations.
