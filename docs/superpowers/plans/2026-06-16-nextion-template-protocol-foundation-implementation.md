# Nextion Template Protocol Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first `Nextion v2` template protocol foundation inside `@notionx/create-nextion-app` by adding machine-readable template installation metadata and ownership-aware update planning.

**Architecture:** Keep the current package layout intact, but introduce a small protocol layer inside `packages/create-nextion-app`. Rendering writes `.nextion/installations.json` and `.nextion/managed-files.json`, project loading reads them back, and update planning starts using ownership classes instead of inferring everything from file status alone.

**Tech Stack:** TypeScript, Vitest, Node.js fs/path APIs, existing `create-nextion-app` scaffolder and unified update flow

---

## File Map

- Create: `packages/create-nextion-app/src/template-contracts.ts`
- Create: `packages/create-nextion-app/src/template-contracts.test.ts`
- Modify: `packages/create-nextion-app/src/metadata.ts`
- Modify: `packages/create-nextion-app/src/render.ts`
- Modify: `packages/create-nextion-app/src/render.test.ts`
- Modify: `packages/create-nextion-app/src/project-context.ts`
- Create: `packages/create-nextion-app/src/project-context.test.ts`
- Create: `packages/create-nextion-app/src/update/ownership.ts`
- Create: `packages/create-nextion-app/src/update/ownership.test.ts`
- Modify: `packages/create-nextion-app/src/update/types.ts`
- Modify: `packages/create-nextion-app/src/update/unified.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.test.ts`

## Task 1: Add Template Protocol Types

**Files:**
- Create: `packages/create-nextion-app/src/template-contracts.ts`
- Test: `packages/create-nextion-app/src/template-contracts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_TEMPLATE,
  buildDefaultInstallationManifest,
  buildDefaultManagedFilesManifest,
} from "./template-contracts.js";

describe("template contracts", () => {
  it("builds a default site template installation manifest", () => {
    const manifest = buildDefaultInstallationManifest({
      contentSourceId: "blog",
      siteTemplate: "blog",
    });

    expect(manifest.templates).toEqual([
      {
        name: "blog",
        kind: "site-template",
        version: 1,
        params: { contentSourceId: "blog" },
      },
    ]);
    expect(manifest.modules).toEqual([]);
  });

  it("classifies generated files into ownership buckets", () => {
    const managed = buildDefaultManagedFilesManifest({
      siteTemplate: DEFAULT_SITE_TEMPLATE,
    });

    expect(managed.platformManaged).toContain("package.json");
    expect(managed.platformManaged).toContain("wrangler.jsonc");
    expect(managed.bridge).toContain("worker/index.ts");
    expect(managed.userOwned).toContain("app/page.tsx");
    expect(managed.userOwned).toContain("components/site/site-header.tsx");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/template-contracts.test.ts
```

Expected: FAIL with a module resolution error for `./template-contracts.js`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/create-nextion-app/src/template-contracts.ts`:

```ts
export const INSTALLATIONS_FILE = ".nextion/installations.json";
export const MANAGED_FILES_FILE = ".nextion/managed-files.json";
export const DEFAULT_SITE_TEMPLATE = "blog" as const;

export type TemplateKind = "site-template" | "feature-module";
export type OwnershipKind = "platformManaged" | "bridge" | "userOwned";

export interface TemplateInstallationRecord {
  name: string;
  kind: TemplateKind;
  version: number;
  params: Record<string, string>;
}

export interface InstallationManifest {
  templates: TemplateInstallationRecord[];
  modules: TemplateInstallationRecord[];
}

export interface ManagedFilesManifest {
  platformManaged: string[];
  bridge: string[];
  userOwned: string[];
}

export function buildDefaultInstallationManifest(input: {
  contentSourceId: string;
  siteTemplate?: string;
}): InstallationManifest {
  const siteTemplate = input.siteTemplate ?? DEFAULT_SITE_TEMPLATE;
  return {
    templates: [
      {
        name: siteTemplate,
        kind: "site-template",
        version: 1,
        params: { contentSourceId: input.contentSourceId },
      },
    ],
    modules: [],
  };
}

export function buildDefaultManagedFilesManifest(input?: {
  siteTemplate?: string;
}): ManagedFilesManifest {
  const siteTemplate = input?.siteTemplate ?? DEFAULT_SITE_TEMPLATE;
  const userOwned = [
    "app/page.tsx",
    "components/site/site-header.tsx",
    "components/site/site-footer.tsx",
    "lib/content/models.ts",
  ];

  if (siteTemplate === "blog") {
    userOwned.push("app/blog/page.tsx", "app/blog/[slug]/page.tsx");
  }

  return {
    platformManaged: [
      "package.json",
      "wrangler.jsonc",
      "next.config.ts",
      ".dev.vars.example",
    ],
    bridge: ["worker/index.ts"],
    userOwned,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/template-contracts.test.ts
```

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/template-contracts.ts packages/create-nextion-app/src/template-contracts.test.ts
git commit -m "feat(scaffold): add template protocol foundations"
```

## Task 2: Emit Installation And Ownership Metadata During Render

**Files:**
- Modify: `packages/create-nextion-app/src/render.ts`
- Modify: `packages/create-nextion-app/src/render.test.ts`
- Modify: `packages/create-nextion-app/src/metadata.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `packages/create-nextion-app/src/render.test.ts`:

```ts
it("writes installation and managed-files manifests into .nextion", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-manifests-"));
  const outDir = path.join(root, "app");
  const answers = applyDefaults(
    {
      projectName: "manifest-app",
      targetDir: outDir,
      adminEmail: "admin@example.com",
      adminPassword: "Password123",
      yes: true,
    },
    ["node", "cli"]
  );

  await render(answers, templatesDir, outDir);

  const installations = JSON.parse(
    await fs.readFile(path.join(outDir, ".nextion/installations.json"), "utf8")
  ) as {
    templates: Array<{ name: string; kind: string; version: number }>;
    modules: unknown[];
  };
  const managedFiles = JSON.parse(
    await fs.readFile(path.join(outDir, ".nextion/managed-files.json"), "utf8")
  ) as {
    platformManaged: string[];
    bridge: string[];
    userOwned: string[];
  };

  expect(installations.templates).toEqual([
    {
      name: "blog",
      kind: "site-template",
      version: 1,
      params: { contentSourceId: "blog" },
    },
  ]);
  expect(installations.modules).toEqual([]);
  expect(managedFiles.platformManaged).toContain("package.json");
  expect(managedFiles.bridge).toContain("worker/index.ts");
  expect(managedFiles.userOwned).toContain("app/blog/page.tsx");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected: FAIL with `ENOENT` for `.nextion/installations.json`.

- [ ] **Step 3: Write minimal implementation**

Update the imports at the top of `packages/create-nextion-app/src/render.ts`:

```ts
import { buildScaffoldMetadata, SCAFFOLD_METADATA_FILE } from "./metadata.js";
import {
  buildDefaultInstallationManifest,
  buildDefaultManagedFilesManifest,
  INSTALLATIONS_FILE,
  MANAGED_FILES_FILE,
} from "./template-contracts.js";
```

Add helper functions near `readPackageVersion()`:

```ts
async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveInitialSiteTemplate(answers: Answers): string {
  return answers.contentSource.id === "blog" ? "blog" : "blog";
}
```

Replace the metadata write block inside `render()`:

```ts
  const metadata = buildScaffoldMetadata(answers, scaffoldVersion);
  const siteTemplate = resolveInitialSiteTemplate(answers);

  await writeJsonFile(
    path.join(absoluteOut, SCAFFOLD_METADATA_FILE),
    metadata
  );
  await writeJsonFile(
    path.join(absoluteOut, INSTALLATIONS_FILE),
    buildDefaultInstallationManifest({
      contentSourceId: answers.contentSource.id,
      siteTemplate,
    })
  );
  await writeJsonFile(
    path.join(absoluteOut, MANAGED_FILES_FILE),
    buildDefaultManagedFilesManifest({ siteTemplate })
  );
```

Add the optional metadata extension to `packages/create-nextion-app/src/metadata.ts`:

```ts
  siteTemplate?: string;
```

And return it from `buildScaffoldMetadata()`:

```ts
    siteTemplate: answers.contentSource.id === "blog" ? "blog" : "blog",
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected: PASS, including the new manifest test.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/render.ts packages/create-nextion-app/src/render.test.ts packages/create-nextion-app/src/metadata.ts
git commit -m "feat(scaffold): write template installation manifests"
```

## Task 3: Load New Metadata Into Project Context

**Files:**
- Modify: `packages/create-nextion-app/src/project-context.ts`
- Create: `packages/create-nextion-app/src/project-context.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/project-context.test.ts`:

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadProjectContext } from "./project-context.js";

describe("loadProjectContext", () => {
  it("loads scaffold, installation, and managed-files metadata", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "nextion-context-"));
    await mkdir(path.join(root, ".nextion"), { recursive: true });

    await writeFile(
      path.join(root, ".nextion/scaffold.json"),
      JSON.stringify({
        projectKind: "nextion",
        projectName: "demo",
        scaffoldVersion: "0.7.2",
        defaultLocale: "en",
        supportedLocales: ["en"],
        nextionSource: "^1.0.0",
        enableSiteSettings: true,
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Title" }],
        },
      })
    );
    await writeFile(
      path.join(root, ".nextion/installations.json"),
      JSON.stringify({
        templates: [
          {
            name: "blog",
            kind: "site-template",
            version: 1,
            params: { contentSourceId: "blog" },
          },
        ],
        modules: [],
      })
    );
    await writeFile(
      path.join(root, ".nextion/managed-files.json"),
      JSON.stringify({
        platformManaged: ["package.json"],
        bridge: ["worker/index.ts"],
        userOwned: ["app/blog/page.tsx"],
      })
    );

    const context = await loadProjectContext(root);

    expect(context.installations.templates[0]?.name).toBe("blog");
    expect(context.managedFiles.bridge).toContain("worker/index.ts");
    expect(context.managedFiles.userOwned).toContain("app/blog/page.tsx");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/project-context.test.ts
```

Expected: FAIL because `context.installations` and `context.managedFiles` do not exist.

- [ ] **Step 3: Write minimal implementation**

Update `packages/create-nextion-app/src/project-context.ts` imports:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseScaffoldMetadata,
  SCAFFOLD_METADATA_FILE,
  type ScaffoldMetadata,
} from "./metadata.js";
import {
  INSTALLATIONS_FILE,
  MANAGED_FILES_FILE,
  type InstallationManifest,
  type ManagedFilesManifest,
} from "./template-contracts.js";
```

Add parsing helpers in the same file:

```ts
function parseInstallations(raw: string): InstallationManifest {
  return JSON.parse(raw) as InstallationManifest;
}

function parseManagedFiles(raw: string): ManagedFilesManifest {
  return JSON.parse(raw) as ManagedFilesManifest;
}
```

Update the context type and loader:

```ts
export interface ProjectContext {
  projectDir: string;
  metadata: ScaffoldMetadata;
  installations: InstallationManifest;
  managedFiles: ManagedFilesManifest;
}

export async function loadProjectContext(
  projectDir: string
): Promise<ProjectContext> {
  const metadataPath = path.join(projectDir, SCAFFOLD_METADATA_FILE);
  const installationsPath = path.join(projectDir, INSTALLATIONS_FILE);
  const managedFilesPath = path.join(projectDir, MANAGED_FILES_FILE);

  let metadataRaw: string;
  let installationsRaw: string;
  let managedFilesRaw: string;

  try {
    [metadataRaw, installationsRaw, managedFilesRaw] = await Promise.all([
      readFile(metadataPath, "utf8"),
      readFile(installationsPath, "utf8"),
      readFile(managedFilesPath, "utf8"),
    ]);
  } catch {
    throw new Error(
      `No Nextion project metadata found in ${projectDir}. Expected ${SCAFFOLD_METADATA_FILE}, ${INSTALLATIONS_FILE}, and ${MANAGED_FILES_FILE}.`
    );
  }

  return {
    projectDir,
    metadata: parseScaffoldMetadata(metadataRaw),
    installations: parseInstallations(installationsRaw),
    managedFiles: parseManagedFiles(managedFilesRaw),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/project-context.test.ts
```

Expected: PASS with the new context test green.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/project-context.ts packages/create-nextion-app/src/project-context.test.ts
git commit -m "feat(update): load template installation context"
```

## Task 4: Make Unified Update Ownership-Aware

**Files:**
- Create: `packages/create-nextion-app/src/update/ownership.ts`
- Create: `packages/create-nextion-app/src/update/ownership.test.ts`
- Modify: `packages/create-nextion-app/src/update/types.ts`
- Modify: `packages/create-nextion-app/src/update/unified.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/update/ownership.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { classifyFileOwnership, toUnifiedUpdateRisk } from "./ownership.js";

describe("ownership-aware update classification", () => {
  const managedFiles = {
    platformManaged: ["package.json", "wrangler.jsonc"],
    bridge: ["worker/index.ts"],
    userOwned: ["app/blog/page.tsx", "components/site/site-header.tsx"],
  };

  it("marks platform-managed files as safe", () => {
    expect(classifyFileOwnership("package.json", managedFiles)).toBe("platformManaged");
    expect(
      toUnifiedUpdateRisk({
        filePath: "package.json",
        status: "updated",
        managedFiles,
      })
    ).toBe("safe");
  });

  it("marks bridge files as review and user-owned files as conflict", () => {
    expect(classifyFileOwnership("worker/index.ts", managedFiles)).toBe("bridge");
    expect(
      toUnifiedUpdateRisk({
        filePath: "worker/index.ts",
        status: "updated",
        managedFiles,
      })
    ).toBe("review");
    expect(
      toUnifiedUpdateRisk({
        filePath: "app/blog/page.tsx",
        status: "updated",
        managedFiles,
      })
    ).toBe("conflict");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/ownership.test.ts
```

Expected: FAIL because `./ownership.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/create-nextion-app/src/update/ownership.ts`:

```ts
import type { ManagedFilesManifest, OwnershipKind } from "../template-contracts.js";

export function classifyFileOwnership(
  filePath: string,
  managedFiles: ManagedFilesManifest
): OwnershipKind | "untracked" {
  if (managedFiles.platformManaged.includes(filePath)) return "platformManaged";
  if (managedFiles.bridge.includes(filePath)) return "bridge";
  if (managedFiles.userOwned.includes(filePath)) return "userOwned";
  return "untracked";
}

export function toUnifiedUpdateRisk(input: {
  filePath: string;
  status: "missing" | "updated" | "unchanged" | "skipped";
  managedFiles: ManagedFilesManifest;
}): "safe" | "review" | "conflict" {
  if (input.status === "missing") return "safe";

  switch (classifyFileOwnership(input.filePath, input.managedFiles)) {
    case "platformManaged":
      return "safe";
    case "bridge":
      return "review";
    case "userOwned":
    case "untracked":
      return "conflict";
  }
}
```

Update `packages/create-nextion-app/src/update/types.ts`:

```ts
export type UnifiedUpdateRisk = "safe" | "review" | "conflict";
```

Update `packages/create-nextion-app/src/update/unified.ts` imports:

```ts
import { toUnifiedUpdateRisk } from "./ownership.js";
```

Update `toFileEntry()` in `packages/create-nextion-app/src/update/unified.ts`:

```ts
  const risk = toUnifiedUpdateRisk({
    filePath: entry.filePath,
    status: entry.status,
    managedFiles: context.managedFiles,
  });

  return {
    label: `file:${entry.filePath}`,
    kind: "file",
    risk,
    group: "codeTemplate",
    async apply() {
      const filePath = path.join(context.projectDir, entry.filePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, entry.nextContent!, "utf8");
    },
  };
```

Update plan construction and summaries in `packages/create-nextion-app/src/update/unified.ts`:

```ts
  const safe = allEntries.filter((entry) => entry.risk === "safe");
  const review = allEntries.filter((entry) => entry.risk === "review");
  const conflicts = allEntries.filter((entry) => entry.risk === "conflict");
```

```ts
export interface UnifiedUpdatePlan {
  safe: UnifiedUpdateEntry[];
  review: UnifiedUpdateEntry[];
  conflicts: UnifiedUpdateEntry[];
  conflictGroups: {
    codeTemplate: UnifiedUpdateEntry[];
    notionContent: UnifiedUpdateEntry[];
    cloudflareBinding: UnifiedUpdateEntry[];
  };
}
```

```ts
    reviewRemaining: plan.review,
```

```ts
  if (summary.reviewRemaining.length > 0) {
    lines.push("review items:");
    for (const entry of summary.reviewRemaining) {
      lines.push(`  - ${entry.label}`);
    }
  }
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/ownership.test.ts src/cli-nextion.test.ts
```

Expected: PASS for the new ownership test, with any summary-format expectation updates applied in the CLI tests.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/update/ownership.ts packages/create-nextion-app/src/update/ownership.test.ts packages/create-nextion-app/src/update/types.ts packages/create-nextion-app/src/update/unified.ts
git commit -m "feat(update): classify scaffold updates by ownership"
```

## Task 5: Surface Template Metadata In The CLI

**Files:**
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.test.ts`

- [ ] **Step 1: Write the failing test**

Append this test to `packages/create-nextion-app/src/cli-nextion.test.ts`:

```ts
  it("prints installed templates before running update", async () => {
    loadProjectContextMock.mockResolvedValue({
      ...context,
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
    });
    buildTemplatePlanMock.mockResolvedValue([]);
    inspectProvisionRepairMock.mockResolvedValue([]);
    runUnifiedUpdateMock.mockResolvedValue({
      appliedSafe: [],
      appliedConflicts: [],
      reviewRemaining: [],
      conflictsRemaining: [],
      needsInstall: false,
      compatibilityPreserved: false,
    });

    await main(["update"]);

    expect(infoMock).toHaveBeenCalledWith("templates:");
    expect(infoMock).toHaveBeenCalledWith("  - blog@1");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/cli-nextion.test.ts
```

Expected: FAIL because the CLI never logs installed templates.

- [ ] **Step 3: Write minimal implementation**

Add this helper to `packages/create-nextion-app/src/cli-nextion.ts`:

```ts
function formatInstalledTemplates(templates: Array<{ name: string; version: number }>): string[] {
  if (templates.length === 0) return [];
  return ["templates:", ...templates.map((template) => `  - ${template.name}@${template.version}`)];
}
```

Log the installed templates at the start of the `update` branch:

```ts
    for (const line of formatInstalledTemplates(context.installations.templates)) {
      p.log.info(line);
    }
```

Update the mocked summary contract in `packages/create-nextion-app/src/cli-nextion.test.ts`:

```ts
  formatUnifiedUpdateSummary: (summary: {
    appliedSafe: Array<{ label: string }>;
    appliedConflicts: Array<{ label: string }>;
    reviewRemaining: Array<{ label: string }>;
    conflictsRemaining: Array<{ label: string }>;
  }) => {
    const lines: string[] = [];
    if (summary.appliedSafe.length > 0) {
      lines.push("safe updates:");
      for (const entry of summary.appliedSafe) lines.push(`  - ${entry.label}`);
    }
    if (summary.reviewRemaining.length > 0) {
      lines.push("review items:");
      for (const entry of summary.reviewRemaining) lines.push(`  - ${entry.label}`);
    }
    if (summary.appliedConflicts.length > 0) {
      lines.push("conflict updates:");
      for (const entry of summary.appliedConflicts) lines.push(`  - ${entry.label}`);
    }
    if (summary.conflictsRemaining.length > 0) {
      lines.push("conflicts remaining:");
      for (const entry of summary.conflictsRemaining) lines.push(`  - ${entry.label}`);
    }
    return lines;
  },
```

- [ ] **Step 4: Run the package test suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test
```

Expected: PASS for the full package test suite.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/cli-nextion.ts packages/create-nextion-app/src/cli-nextion.test.ts
git commit -m "feat(cli): surface template protocol metadata"
```

## Task 6: Final Verification

**Files:**
- Modify: none

- [ ] **Step 1: Run lint**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec eslint src
```

Expected: PASS with no lint errors.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec tsc --noEmit
```

Expected: PASS with no type errors.

- [ ] **Step 3: Run focused regression suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts src/project-context.test.ts src/update/ownership.test.ts src/cli-nextion.test.ts
```

Expected: PASS for rendering, metadata loading, ownership classification, and CLI update flows.

- [ ] **Step 4: Run full package test suite one more time**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test
```

Expected: PASS.

- [ ] **Step 5: Commit final verification note**

```bash
git status --short
git commit --allow-empty -m "chore(scaffold): verify template protocol foundation"
```

## Self-Review

### Spec Coverage

- Product boundary reset: partially covered by surfacing template installation metadata in CLI output and context loading.
- Template protocol: covered by `template-contracts.ts`, installation manifests, and managed-files manifests.
- Ownership model: covered by `managed-files.json` and ownership-aware update classification.
- Upgrade foundation: covered by changing update risk from binary file-state guessing to ownership-aware `safe/review/conflict`.
- Full template ecosystem, modules, and a separate upgrader package: intentionally deferred to later plans.

### Placeholder Scan

- No `TODO`, `TBD`, or "implement later" markers remain in tasks.
- Every code-writing step contains concrete code blocks.
- Every testing step includes an exact command and expected outcome.

### Type Consistency

- Ownership kinds are consistent across `template-contracts.ts`, `project-context.ts`, and `update/ownership.ts`.
- Installation manifest shape is used consistently in render, context loading, and CLI reporting.
- Unified update risk is consistently expanded to `safe | review | conflict` across types, update execution, and test mocks.
