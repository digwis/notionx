# Nextion Diff And Protocol Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next visible `Nextion v2` protocol layer by making upgrade planning read protocol-owned file targets and by adding a user-facing `nextion diff` command with optional upgrade preview.

**Architecture:** Keep all work inside `packages/create-nextion-app` for now. Introduce a small template registry for installed template resolution, replace hard-coded scaffold sync targets with protocol-derived managed files, and add a dedicated diff planner that the CLI can surface as `nextion diff` and `nextion diff --upgrade`.

**Tech Stack:** TypeScript, Vitest, Node.js fs/path APIs, existing `create-nextion-app` CLI, protocol metadata in `.nextion/*`, unified update planner

---

## Scope Split

This plan intentionally covers:

- protocol-derived upgrade targets
- template registry awareness
- `nextion diff`
- `nextion diff --upgrade`

This plan intentionally does **not** cover:

- `nextion add <template>` file generation into an existing project
- multi-template composition writes
- template migration objects

Those belong in the next plan after this one lands, because they require a real install engine rather than read-only inspection and preview.

## File Map

- Create: `packages/create-nextion-app/src/template-registry.ts`
- Create: `packages/create-nextion-app/src/template-registry.test.ts`
- Create: `packages/create-nextion-app/src/update/protocol-targets.ts`
- Create: `packages/create-nextion-app/src/update/protocol-targets.test.ts`
- Create: `packages/create-nextion-app/src/diff.ts`
- Create: `packages/create-nextion-app/src/diff.test.ts`
- Modify: `packages/create-nextion-app/src/template-contracts.ts`
- Modify: `packages/create-nextion-app/src/update/template-sync.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.test.ts`

## Task 1: Add A Template Registry

**Files:**
- Create: `packages/create-nextion-app/src/template-registry.ts`
- Test: `packages/create-nextion-app/src/template-registry.test.ts`
- Modify: `packages/create-nextion-app/src/template-contracts.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/template-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  getTemplateDefinition,
  listTemplateDefinitions,
  resolveInstalledTemplates,
} from "./template-registry.js";

describe("template registry", () => {
  it("returns the built-in blog template definition", () => {
    const template = getTemplateDefinition("blog");

    expect(template).toEqual({
      name: "blog",
      kind: "site-template",
      version: 1,
      managedFiles: [
        "package.json",
        "wrangler.jsonc",
        "next.config.ts",
        ".dev.vars.example",
      ],
      bridgeFiles: ["worker/index.ts"],
      userOwnedFiles: [
        "app/page.tsx",
        "components/site/site-header.tsx",
        "components/site/site-footer.tsx",
        "lib/content/models.ts",
        "app/blog/page.tsx",
        "app/blog/[slug]/page.tsx",
      ],
    });
  });

  it("resolves installed templates from the manifest", () => {
    const installed = resolveInstalledTemplates({
      templates: [
        {
          name: "blog",
          kind: "site-template",
          version: 1,
          params: { contentSourceId: "blog" },
        },
      ],
      modules: [],
    });

    expect(installed.map((template) => template.name)).toEqual(["blog"]);
  });

  it("lists built-in definitions for CLI inspection", () => {
    expect(listTemplateDefinitions().map((template) => template.name)).toContain(
      "blog"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/template-registry.test.ts
```

Expected: FAIL with a module resolution error for `./template-registry.js`.

- [ ] **Step 3: Write minimal implementation**

Update `packages/create-nextion-app/src/template-contracts.ts` to add a reusable definition type:

```ts
export interface TemplateDefinition {
  name: string;
  kind: TemplateKind;
  version: number;
  managedFiles: string[];
  bridgeFiles: string[];
  userOwnedFiles: string[];
}
```

Create `packages/create-nextion-app/src/template-registry.ts`:

```ts
import type {
  InstallationManifest,
  TemplateDefinition,
  TemplateInstallationRecord,
} from "./template-contracts.js";
import { DEFAULT_SITE_TEMPLATE, buildDefaultManagedFilesManifest } from "./template-contracts.js";

const builtInTemplates: TemplateDefinition[] = [
  {
    name: DEFAULT_SITE_TEMPLATE,
    kind: "site-template",
    version: 1,
    managedFiles: buildDefaultManagedFilesManifest({ siteTemplate: "blog" }).platformManaged,
    bridgeFiles: buildDefaultManagedFilesManifest({ siteTemplate: "blog" }).bridge,
    userOwnedFiles: buildDefaultManagedFilesManifest({ siteTemplate: "blog" }).userOwned,
  },
];

function assertTemplateRecord(
  record: TemplateInstallationRecord,
  template: TemplateDefinition | undefined
): TemplateDefinition {
  if (template === undefined) {
    throw new Error(`Unknown installed template: ${record.name}`);
  }
  return template;
}

export function listTemplateDefinitions(): TemplateDefinition[] {
  return [...builtInTemplates];
}

export function getTemplateDefinition(name: string): TemplateDefinition | undefined {
  return builtInTemplates.find((template) => template.name === name);
}

export function resolveInstalledTemplates(
  manifest: InstallationManifest
): TemplateDefinition[] {
  return manifest.templates.map((record) =>
    assertTemplateRecord(record, getTemplateDefinition(record.name))
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/template-registry.test.ts
```

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/template-contracts.ts packages/create-nextion-app/src/template-registry.ts packages/create-nextion-app/src/template-registry.test.ts
git commit -m "feat(protocol): add template registry"
```

## Task 2: Drive Upgrade Targets From Protocol Metadata

**Files:**
- Create: `packages/create-nextion-app/src/update/protocol-targets.ts`
- Test: `packages/create-nextion-app/src/update/protocol-targets.test.ts`
- Modify: `packages/create-nextion-app/src/update/template-sync.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/update/protocol-targets.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { listProtocolUpgradeTargets } from "./protocol-targets.js";

describe("protocol upgrade targets", () => {
  it("includes platform-managed and bridge files, but excludes user-owned files", () => {
    const files = listProtocolUpgradeTargets({
      platformManaged: ["package.json", "wrangler.jsonc"],
      bridge: ["worker/index.ts"],
      userOwned: ["app/blog/page.tsx", "components/site/site-header.tsx"],
    });

    expect(files).toEqual(["package.json", "worker/index.ts", "wrangler.jsonc"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/update/protocol-targets.test.ts
```

Expected: FAIL because `./protocol-targets.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/create-nextion-app/src/update/protocol-targets.ts`:

```ts
import type { ManagedFilesManifest } from "../template-contracts.js";

export function listProtocolUpgradeTargets(
  managedFiles: ManagedFilesManifest
): string[] {
  return [...new Set([...managedFiles.platformManaged, ...managedFiles.bridge])].sort();
}
```

Update `packages/create-nextion-app/src/update/template-sync.ts`:

```ts
import { listProtocolUpgradeTargets } from "./protocol-targets.js";
```

Replace the hard-coded target loop:

```ts
    const targetFiles = listProtocolUpgradeTargets(input.context.managedFiles);

    return Promise.all(
      targetFiles.map(async (filePath) => {
        const projectPath = path.join(context.projectDir, filePath);
        const renderedPath = path.join(tempRoot, filePath);
        const currentContent = await readIfExists(projectPath);
        const nextContent = await readIfExists(renderedPath);

        if (nextContent === null) {
          return { filePath, status: "skipped" as const };
        }
        if (currentContent === null) {
          return { filePath, status: "missing" as const, nextContent };
        }
        if (currentContent === nextContent) {
          return { filePath, status: "unchanged" as const, nextContent };
        }
        return { filePath, status: "updated" as const, nextContent };
      })
    );
```

Use the existing `context` parameter in the function body:

```ts
export async function buildUpdatePlan(
  context: ProjectContext
): Promise<UpdatePlanEntry[]> {
```

- [ ] **Step 4: Add a regression assertion for bridge files**

Append this test to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
  it("includes bridge files from protocol metadata in the update plan", async () => {
    const plan = await actualBuildUpdatePlan(unifiedContext);

    expect(plan.some((entry) => entry.filePath === "worker/index.ts")).toBe(true);
  });
```

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/update/protocol-targets.test.ts src/update/update.test.ts
```

Expected: PASS for the new protocol target test and the new bridge-file regression.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/update/protocol-targets.ts packages/create-nextion-app/src/update/protocol-targets.test.ts packages/create-nextion-app/src/update/template-sync.ts packages/create-nextion-app/src/update/update.test.ts
git commit -m "feat(update): derive upgrade targets from protocol metadata"
```

## Task 3: Add A Diff Planner

**Files:**
- Create: `packages/create-nextion-app/src/diff.ts`
- Test: `packages/create-nextion-app/src/diff.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildDiffSummary, formatDiffSummary } from "./diff.js";

describe("diff summary", () => {
  it("summarizes installed templates and ownership counts", () => {
    const summary = buildDiffSummary({
      installations: {
        templates: [
          {
            name: "blog",
            kind: "site-template",
            version: 1,
            params: { contentSourceId: "blog" },
          },
        ],
        modules: [],
      },
      managedFiles: {
        platformManaged: ["package.json", "wrangler.jsonc"],
        bridge: ["worker/index.ts"],
        userOwned: ["app/blog/page.tsx", "components/site/site-header.tsx"],
      },
    });

    expect(summary.templates).toEqual(["blog@1"]);
    expect(summary.ownership).toEqual({
      platformManaged: 2,
      bridge: 1,
      userOwned: 2,
    });
  });

  it("formats a readable diff summary", () => {
    expect(
      formatDiffSummary({
        templates: ["blog@1"],
        ownership: {
          platformManaged: 2,
          bridge: 1,
          userOwned: 2,
        },
      })
    ).toEqual([
      "templates:",
      "  - blog@1",
      "ownership:",
      "  - platform-managed: 2",
      "  - bridge: 1",
      "  - user-owned: 2",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/diff.test.ts
```

Expected: FAIL because `./diff.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/create-nextion-app/src/diff.ts`:

```ts
import type {
  InstallationManifest,
  ManagedFilesManifest,
} from "./template-contracts.js";

export interface DiffSummary {
  templates: string[];
  ownership: {
    platformManaged: number;
    bridge: number;
    userOwned: number;
  };
}

export function buildDiffSummary(input: {
  installations: InstallationManifest;
  managedFiles: ManagedFilesManifest;
}): DiffSummary {
  return {
    templates: input.installations.templates.map(
      (template) => `${template.name}@${template.version}`
    ),
    ownership: {
      platformManaged: input.managedFiles.platformManaged.length,
      bridge: input.managedFiles.bridge.length,
      userOwned: input.managedFiles.userOwned.length,
    },
  };
}

export function formatDiffSummary(summary: DiffSummary): string[] {
  return [
    "templates:",
    ...summary.templates.map((template) => `  - ${template}`),
    "ownership:",
    `  - platform-managed: ${summary.ownership.platformManaged}`,
    `  - bridge: ${summary.ownership.bridge}`,
    `  - user-owned: ${summary.ownership.userOwned}`,
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/diff.test.ts
```

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/diff.ts packages/create-nextion-app/src/diff.test.ts
git commit -m "feat(cli): add diff summary planner"
```

## Task 4: Add Upgrade Preview Formatting

**Files:**
- Modify: `packages/create-nextion-app/src/diff.ts`
- Test: `packages/create-nextion-app/src/diff.test.ts`

- [ ] **Step 1: Write the failing test**

Append this test to `packages/create-nextion-app/src/diff.test.ts`:

```ts
  it("formats an upgrade preview grouped by risk", () => {
    expect(
      formatUpgradePreview({
        safe: ["file:package.json"],
        review: ["file:worker/index.ts"],
        conflict: ["file:app/blog/page.tsx"],
      })
    ).toEqual([
      "upgrade preview:",
      "  safe:",
      "    - file:package.json",
      "  review:",
      "    - file:worker/index.ts",
      "  conflict:",
      "    - file:app/blog/page.tsx",
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/diff.test.ts
```

Expected: FAIL because `formatUpgradePreview` is not exported.

- [ ] **Step 3: Write minimal implementation**

Extend `packages/create-nextion-app/src/diff.ts`:

```ts
export interface UpgradePreviewSummary {
  safe: string[];
  review: string[];
  conflict: string[];
}

export function formatUpgradePreview(summary: UpgradePreviewSummary): string[] {
  return [
    "upgrade preview:",
    "  safe:",
    ...summary.safe.map((label) => `    - ${label}`),
    "  review:",
    ...summary.review.map((label) => `    - ${label}`),
    "  conflict:",
    ...summary.conflict.map((label) => `    - ${label}`),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/diff.test.ts
```

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/diff.ts packages/create-nextion-app/src/diff.test.ts
git commit -m "feat(diff): add upgrade preview formatting"
```

## Task 5: Wire `nextion diff` And `nextion diff --upgrade`

**Files:**
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests to `packages/create-nextion-app/src/cli-nextion.test.ts`:

```ts
  it("prints template and ownership summary for diff", async () => {
    loadProjectContextMock.mockResolvedValue(context);

    await main(["diff"]);

    expect(infoMock).toHaveBeenCalledWith("templates:");
    expect(infoMock).toHaveBeenCalledWith("  - blog@1");
    expect(infoMock).toHaveBeenCalledWith("ownership:");
    expect(infoMock).toHaveBeenCalledWith("  - platform-managed: 1");
  });

  it("prints upgrade preview for diff --upgrade", async () => {
    loadProjectContextMock.mockResolvedValue(context);
    buildTemplatePlanMock.mockResolvedValue([
      {
        filePath: "package.json",
        status: "updated",
        nextContent: "{}",
      },
      {
        filePath: "worker/index.ts",
        status: "updated",
        nextContent: "export default {};",
      },
    ]);
    inspectProvisionRepairMock.mockResolvedValue([]);

    await main(["diff", "--upgrade"]);

    expect(infoMock).toHaveBeenCalledWith("upgrade preview:");
    expect(infoMock).toHaveBeenCalledWith("  safe:");
    expect(infoMock).toHaveBeenCalledWith("    - file:package.json");
    expect(infoMock).toHaveBeenCalledWith("  review:");
    expect(infoMock).toHaveBeenCalledWith("    - file:worker/index.ts");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/cli-nextion.test.ts
```

Expected: FAIL because the CLI does not implement `diff`.

- [ ] **Step 3: Write minimal implementation**

Update the imports in `packages/create-nextion-app/src/cli-nextion.ts`:

```ts
import { buildDiffSummary, formatDiffSummary, formatUpgradePreview } from "./diff.js";
import { buildUnifiedUpdatePlan } from "./update/unified.js";
```

Add this branch before the existing `update` branch:

```ts
  if (command === "diff" && !subcommand) {
    const context = await loadProjectContext(process.cwd());
    for (const line of formatDiffSummary(
      buildDiffSummary({
        installations: context.installations,
        managedFiles: context.managedFiles,
      })
    )) {
      p.log.info(line);
    }
    return;
  }
```

Add this second branch for upgrade preview:

```ts
  if (command === "diff" && subcommand === "--upgrade") {
    const context = await loadProjectContext(process.cwd());
    const [templateEntries, repairEntries] = await Promise.all([
      buildUpdatePlan(context),
      inspectProvisionRepair(context),
    ]);
    const plan = await buildUnifiedUpdatePlan({
      context,
      templateEntries,
      repairEntries,
    });

    for (const line of formatUpgradePreview({
      safe: plan.safe.map((entry) => entry.label),
      review: plan.review.map((entry) => entry.label),
      conflict: plan.conflicts.map((entry) => entry.label),
    })) {
      p.log.info(line);
    }
    return;
  }
```

Update the shared `context` fixture in `packages/create-nextion-app/src/cli-nextion.test.ts` so it already includes:

```ts
  installations: {
    templates: [
      {
        name: "blog",
        kind: "site-template",
        version: 1,
        params: { contentSourceId: "blog" },
      },
    ],
    modules: [],
  },
  managedFiles: {
    platformManaged: ["package.json"],
    bridge: ["worker/index.ts"],
    userOwned: ["app/blog/page.tsx"],
  },
```

- [ ] **Step 4: Run the relevant test suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/cli-nextion.test.ts src/diff.test.ts src/update/update.test.ts
```

Expected: PASS for diff summary, upgrade preview, and update regressions.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/cli-nextion.ts packages/create-nextion-app/src/cli-nextion.test.ts packages/create-nextion-app/src/diff.ts packages/create-nextion-app/src/diff.test.ts
git commit -m "feat(cli): add diff and upgrade preview commands"
```

## Task 6: Final Verification

**Files:**
- Modify: none

- [ ] **Step 1: Run focused regression suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/template-registry.test.ts src/update/protocol-targets.test.ts src/diff.test.ts src/cli-nextion.test.ts src/update/update.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full package test suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Check workspace state**

Run:

```bash
git status --short
```

Expected: only the planned files are modified or created.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/template-registry.ts packages/create-nextion-app/src/template-registry.test.ts packages/create-nextion-app/src/update/protocol-targets.ts packages/create-nextion-app/src/update/protocol-targets.test.ts packages/create-nextion-app/src/diff.ts packages/create-nextion-app/src/diff.test.ts packages/create-nextion-app/src/update/template-sync.ts packages/create-nextion-app/src/cli-nextion.ts packages/create-nextion-app/src/cli-nextion.test.ts packages/create-nextion-app/src/template-contracts.ts packages/create-nextion-app/src/update/update.test.ts
git commit -m "chore(cli): verify protocol-driven diff foundations"
```

## Self-Review

### Spec Coverage

- Template protocol as a machine-readable product layer: covered by the new template registry and protocol target resolver.
- Upgrade system respecting ownership boundaries: covered by replacing hard-coded scaffold sync targets with protocol-managed and bridge targets.
- `diff` as a first-class command: covered by `buildDiffSummary`, `formatDiffSummary`, and CLI wiring.
- `diff --upgrade` previewing safe/review/conflict: covered by the upgrade preview formatter and reuse of `buildUnifiedUpdatePlan`.
- `add` installation flow: intentionally deferred because it is a separate write-path subsystem and should be planned independently after read-only inspection lands.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” markers remain.
- Every code-writing step includes concrete code blocks.
- Every verification step includes an exact command and expected result.

### Type Consistency

- `TemplateDefinition` uses the same `TemplateKind` family as `TemplateInstallationRecord`.
- Upgrade preview uses the existing `safe`, `review`, and `conflict` labels already introduced in `UnifiedUpdatePlan`.
- Diff summary reads `installations` and `managedFiles`, which are already part of `ProjectContext`.
