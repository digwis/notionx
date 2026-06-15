# Unify Nextion Update Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `nextion update` the only public upgrade command by folding runtime dependency upgrades, scaffold-managed file sync, and Notion / Cloudflare reconciliation into one conflict-aware maintenance flow.

**Architecture:** Keep the CLI thin and move orchestration into `packages/create-nextion-app/src/update/`. The unified flow should first build a full update plan, classify entries into `safe` and `conflict`, auto-apply only safe entries, then ask once whether to apply grouped conflicts. Reuse the current `runUpdate()` template-sync logic and `runProvisionRepair()` provisioning logic by refactoring them into inspectable sub-steps instead of rewriting the provisioner from scratch.

**Tech Stack:** TypeScript, Vitest, Clack prompts, Nextion scaffold metadata, existing provisioning helpers

---

## File Map

- Create: `packages/create-nextion-app/src/update/types.ts`
  Purpose: Shared types for unified update entries, grouped conflicts, and the final summary.
- Create: `packages/create-nextion-app/src/update/unified.ts`
  Purpose: Orchestrate scanning, classification, safe application, optional conflict application, and summary generation.
- Modify: `packages/create-nextion-app/src/update/index.ts`
  Purpose: Keep a compatibility wrapper or re-export around the new unified update flow so call sites stay simple.
- Modify: `packages/create-nextion-app/src/update/template-sync.ts`
  Purpose: Return richer file diff information that lets the unified flow classify scaffold-managed changes.
- Modify: `packages/create-nextion-app/src/update/update.test.ts`
  Purpose: Cover the new unified summary, file classification, and compatibility preservation behavior.
- Create: `packages/create-nextion-app/src/provision/inspect.ts`
  Purpose: Inspect Notion / Cloudflare repair actions without applying them, and classify each action as safe or conflict.
- Modify: `packages/create-nextion-app/src/provision/repair.ts`
  Purpose: Expose a reusable non-interactive repair plan builder that unified update can call internally.
- Modify: `packages/create-nextion-app/src/provision/index.ts`
  Purpose: Support selective application of inspected repair actions instead of only all-or-nothing repair execution.
- Modify: `packages/create-nextion-app/src/provision/repair.test.ts`
  Purpose: Lock the inspectable repair workflow and selective safe-only execution.
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
  Purpose: Route `nextion update` into the unified flow, ask once about grouped conflicts, and remove public `provision repair` support.
- Create: `packages/create-nextion-app/src/cli-nextion.test.ts`
  Purpose: Verify CLI behavior, including unsupported `provision repair` and grouped confirmation messaging.
- Modify: `docs/architecture/upgrading-nextion.md`
  Purpose: Update operator docs to a single-command upgrade workflow.
- Modify: `packages/create-nextion-app/src/templates/README.md.tmpl`
  Purpose: Update generated project docs so new projects tell users to run only `nextion update`.

### Task 1: Build The Unified Update Plan For Files And Summary

**Files:**
- Create: `packages/create-nextion-app/src/update/types.ts`
- Create: `packages/create-nextion-app/src/update/unified.ts`
- Modify: `packages/create-nextion-app/src/update/template-sync.ts`
- Modify: `packages/create-nextion-app/src/update/index.ts`
- Modify: `packages/create-nextion-app/src/update/update.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
const context: ProjectContext = {
  projectDir: "/tmp/demo",
  metadata: {
    projectKind: "nextion",
    projectName: "demo",
    scaffoldVersion: "0.6.1",
    defaultLocale: "en",
    supportedLocales: ["en"],
    nextionSource: "^1.0.0",
    enableSiteSettings: true,
    contentSource: {
      id: "blog",
      title: "Blog",
      fields: [{ key: "title", notionName: "Name" }],
    },
  },
};

describe("buildUnifiedUpdatePlan", () => {
  it("classifies missing scaffold-managed files as safe entries", async () => {
    const plan = await buildUnifiedUpdatePlan({
      context,
      templateEntries: [
        { filePath: "README.md", status: "missing", nextContent: "# Demo\n" },
      ],
      repairEntries: [],
    });

    expect(plan.safe.map((entry) => entry.label)).toContain("file:README.md");
    expect(plan.conflicts).toHaveLength(0);
  });

  it("classifies changed scaffold-managed files as conflicts", async () => {
    const plan = await buildUnifiedUpdatePlan({
      context,
      templateEntries: [
        { filePath: "wrangler.jsonc", status: "updated", nextContent: "{}\n" },
      ],
      repairEntries: [],
    });

    expect(plan.safe).toHaveLength(0);
    expect(plan.conflicts.map((entry) => entry.label)).toContain(
      "file:wrangler.jsonc"
    );
    expect(plan.conflictGroups.codeTemplate).toHaveLength(1);
  });
});

describe("runUnifiedUpdate", () => {
  it("applies only safe entries automatically and reports grouped conflicts", async () => {
    const summary = await runUnifiedUpdate(context, {
      templateEntries: [
        { filePath: "README.md", status: "missing", nextContent: "# Demo\n" },
        { filePath: "wrangler.jsonc", status: "updated", nextContent: "{}\n" },
      ],
      repairEntries: [],
      conflictChoice: "safe-only",
    });

    expect(summary.appliedSafe.map((entry) => entry.label)).toContain(
      "file:README.md"
    );
    expect(summary.appliedConflicts).toHaveLength(0);
    expect(summary.conflictsRemaining.map((entry) => entry.label)).toContain(
      "file:wrangler.jsonc"
    );
  });
});

describe("formatUnifiedUpdateSummary", () => {
  it("prints safe, conflict, and follow-up groups", () => {
    const lines = formatUnifiedUpdateSummary({
      appliedSafe: [{ label: "file:README.md", kind: "file", risk: "safe" }],
      appliedConflicts: [],
      conflictsRemaining: [
        { label: "file:wrangler.jsonc", kind: "file", risk: "conflict" },
      ],
      needsInstall: true,
      compatibilityPreserved: true,
    });

    expect(lines).toContain("safe updates:");
    expect(lines).toContain("conflicts remaining:");
    expect(lines).toContain("  - run `pnpm install`");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/update/update.test.ts
```

Expected:

```text
FAIL because buildUnifiedUpdatePlan, runUnifiedUpdate, and formatUnifiedUpdateSummary do not exist yet.
```

- [ ] **Step 3: Write the minimal shared types**

Create `packages/create-nextion-app/src/update/types.ts`:

```ts
export type UnifiedUpdateRisk = "safe" | "conflict";

export type UnifiedUpdateKind = "file" | "notion" | "cloudflare";

export interface UnifiedUpdateEntry {
  label: string;
  kind: UnifiedUpdateKind;
  risk: UnifiedUpdateRisk;
  group: "codeTemplate" | "notionContent" | "cloudflareBinding";
  apply(): Promise<void>;
}

export interface UnifiedUpdatePlan {
  safe: UnifiedUpdateEntry[];
  conflicts: UnifiedUpdateEntry[];
  conflictGroups: {
    codeTemplate: UnifiedUpdateEntry[];
    notionContent: UnifiedUpdateEntry[];
    cloudflareBinding: UnifiedUpdateEntry[];
  };
}

export interface UnifiedUpdateSummary {
  appliedSafe: UnifiedUpdateEntry[];
  appliedConflicts: UnifiedUpdateEntry[];
  conflictsRemaining: UnifiedUpdateEntry[];
  needsInstall: boolean;
  compatibilityPreserved: boolean;
}
```

- [ ] **Step 4: Write the minimal unified planner and summary formatter**

Create `packages/create-nextion-app/src/update/unified.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectContext } from "../project-context.js";
import type { UpdatePlanEntry } from "./template-sync.js";
import type {
  UnifiedUpdateEntry,
  UnifiedUpdatePlan,
  UnifiedUpdateSummary,
} from "./types.js";

function toFileEntry(
  context: ProjectContext,
  entry: UpdatePlanEntry
): UnifiedUpdateEntry | null {
  if (entry.status === "unchanged" || entry.status === "skipped") return null;
  if (entry.nextContent === undefined) return null;

  const risk = entry.status === "missing" ? "safe" : "conflict";
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
}

export async function buildUnifiedUpdatePlan(input: {
  context: ProjectContext;
  templateEntries: UpdatePlanEntry[];
  repairEntries: UnifiedUpdateEntry[];
}): Promise<UnifiedUpdatePlan> {
  const fileEntries = input.templateEntries
    .map((entry) => toFileEntry(input.context, entry))
    .filter((entry): entry is UnifiedUpdateEntry => entry !== null);
  const allEntries = [...fileEntries, ...input.repairEntries];
  const safe = allEntries.filter((entry) => entry.risk === "safe");
  const conflicts = allEntries.filter((entry) => entry.risk === "conflict");

  return {
    safe,
    conflicts,
    conflictGroups: {
      codeTemplate: conflicts.filter((entry) => entry.group === "codeTemplate"),
      notionContent: conflicts.filter((entry) => entry.group === "notionContent"),
      cloudflareBinding: conflicts.filter(
        (entry) => entry.group === "cloudflareBinding"
      ),
    },
  };
}

export async function runUnifiedUpdate(
  context: ProjectContext,
  input: {
    templateEntries: UpdatePlanEntry[];
    repairEntries: UnifiedUpdateEntry[];
    conflictChoice: "apply-all" | "safe-only";
  }
): Promise<UnifiedUpdateSummary> {
  const plan = await buildUnifiedUpdatePlan({
    context,
    templateEntries: input.templateEntries,
    repairEntries: input.repairEntries,
  });

  for (const entry of plan.safe) {
    await entry.apply();
  }

  const appliedConflicts: UnifiedUpdateEntry[] = [];
  if (input.conflictChoice === "apply-all") {
    for (const entry of plan.conflicts) {
      await entry.apply();
      appliedConflicts.push(entry);
    }
  }

  return {
    appliedSafe: plan.safe,
    appliedConflicts,
    conflictsRemaining:
      input.conflictChoice === "apply-all" ? [] : plan.conflicts,
    needsInstall: [...plan.safe, ...appliedConflicts].some(
      (entry) => entry.label === "file:package.json"
    ),
    compatibilityPreserved:
      context.metadata.compatibility === "legacy-vinext" ||
      context.metadata.nextionSource === "workspace:*",
  };
}

export function formatUnifiedUpdateSummary(
  summary: UnifiedUpdateSummary
): string[] {
  const lines: string[] = [];
  if (summary.appliedSafe.length) {
    lines.push("safe updates:");
    for (const entry of summary.appliedSafe) lines.push(`  - ${entry.label}`);
  }
  if (summary.appliedConflicts.length) {
    lines.push("conflict updates:");
    for (const entry of summary.appliedConflicts) {
      lines.push(`  - ${entry.label}`);
    }
  }
  if (summary.conflictsRemaining.length) {
    lines.push("conflicts remaining:");
    for (const entry of summary.conflictsRemaining) {
      lines.push(`  - ${entry.label}`);
    }
  }
  if (summary.compatibilityPreserved) {
    lines.push("compatibility:");
    lines.push("  - legacy mode preserved: `nextionSource` left as `workspace:*`");
  }
  if (summary.needsInstall) {
    lines.push("follow-up:");
    lines.push("  - run `pnpm install`");
  }
  return lines;
}
```

- [ ] **Step 5: Connect the existing update entrypoint to the new summary type**

Update `packages/create-nextion-app/src/update/index.ts` to re-export the new
flow while preserving a stable import path:

```ts
export {
  buildUnifiedUpdatePlan,
  formatUnifiedUpdateSummary,
  runUnifiedUpdate as runUpdate,
} from "./unified.js";

export type {
  UnifiedUpdateEntry,
  UnifiedUpdatePlan,
  UnifiedUpdateSummary as UpdateSummary,
} from "./types.js";
```

And extend `packages/create-nextion-app/src/update/template-sync.ts` only
enough to keep the current `UpdatePlanEntry` shape exported:

```ts
export interface UpdatePlanEntry {
  filePath: string;
  status: "updated" | "unchanged" | "missing" | "skipped";
  nextContent?: string;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/update/update.test.ts
```

Expected:

```text
PASS for unified file planning and summary formatting.
```

- [ ] **Step 7: Commit**

```bash
git add packages/create-nextion-app/src/update/types.ts \
  packages/create-nextion-app/src/update/unified.ts \
  packages/create-nextion-app/src/update/index.ts \
  packages/create-nextion-app/src/update/template-sync.ts \
  packages/create-nextion-app/src/update/update.test.ts
git commit -m "feat: add unified update planning"
```

### Task 2: Expose Provision Inspection And Safe-Only Repair Application

**Files:**
- Create: `packages/create-nextion-app/src/provision/inspect.ts`
- Modify: `packages/create-nextion-app/src/provision/index.ts`
- Modify: `packages/create-nextion-app/src/provision/repair.ts`
- Modify: `packages/create-nextion-app/src/provision/repair.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/create-nextion-app/src/provision/repair.test.ts`:

```ts
const inspectProvisionMock = vi.hoisted(() => vi.fn());

vi.mock("./inspect.js", async () => {
  const actual =
    await vi.importActual<typeof import("./inspect.js")>("./inspect.js");
  return {
    ...actual,
    inspectProvisionRepair: inspectProvisionMock,
  };
});

describe("inspectProvisionRepair", () => {
  it("marks additive Notion schema repairs as safe", async () => {
    inspectProvisionMock.mockResolvedValueOnce([
      {
        label: "notion:add-property:Count",
        kind: "notion",
        group: "notionContent",
        risk: "safe",
        apply: vi.fn(),
      },
    ]);

    const entries = await inspectProvisionRepair(context);

    expect(entries[0]?.risk).toBe("safe");
  });

  it("marks populated site settings replacements as conflicts", async () => {
    inspectProvisionMock.mockResolvedValueOnce([
      {
        label: "notion:update-site-settings:Nav",
        kind: "notion",
        group: "notionContent",
        risk: "conflict",
        apply: vi.fn(),
      },
    ]);

    const entries = await inspectProvisionRepair(context);

    expect(entries[0]?.risk).toBe("conflict");
  });
});

describe("runProvisionRepair", () => {
  it("can apply only safe inspected entries", async () => {
    const safeApply = vi.fn();
    const conflictApply = vi.fn();
    inspectProvisionMock.mockResolvedValueOnce([
      {
        label: "cloudflare:add-var:VINEXT_KV_CACHE",
        kind: "cloudflare",
        group: "cloudflareBinding",
        risk: "safe",
        apply: safeApply,
      },
      {
        label: "notion:update-site-settings:Nav",
        kind: "notion",
        group: "notionContent",
        risk: "conflict",
        apply: conflictApply,
      },
    ]);

    await runProvisionRepair(context, undefined, { conflictChoice: "safe-only" });

    expect(safeApply).toHaveBeenCalledTimes(1);
    expect(conflictApply).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/provision/repair.test.ts
```

Expected:

```text
FAIL because inspectProvisionRepair and selective safe-only repair execution do not exist.
```

- [ ] **Step 3: Create the inspection module**

Create `packages/create-nextion-app/src/provision/inspect.ts`:

```ts
import type { ProjectContext } from "../project-context.js";
import type { UnifiedUpdateEntry } from "../update/types.js";
import { buildRepairAnswers } from "./repair.js";

export async function inspectProvisionRepair(
  context: ProjectContext
): Promise<UnifiedUpdateEntry[]> {
  const answers = buildRepairAnswers(context);

  return [
    {
      label: "cloudflare:repair-bindings",
      kind: "cloudflare",
      group: "cloudflareBinding",
      risk: "safe",
      async apply() {
        void answers;
      },
    },
  ];
}
```

- [ ] **Step 4: Refactor repair execution to consume inspected entries**

Update `packages/create-nextion-app/src/provision/repair.ts` to accept a
conflict choice and to delegate action enumeration:

```ts
import type { UnifiedUpdateEntry } from "../update/types.js";
import { inspectProvisionRepair } from "./inspect.js";

export function buildRepairAnswers(context: ProjectContext): Answers {
  return {
    projectName: context.metadata.projectName,
    targetDir: context.projectDir,
    defaultLocale: context.metadata.defaultLocale,
    supportedLocales: [...context.metadata.supportedLocales],
    nextionSource: context.metadata.nextionSource,
    enableSiteSettings: context.metadata.enableSiteSettings ?? true,
    contentSource: {
      id: context.metadata.contentSource.id,
      title: context.metadata.contentSource.title,
      fields: context.metadata.contentSource.fields.map((field) => ({
        key: field.key,
        notionName: field.notionName,
      })),
    },
    adminEmail: DEFAULT_ANSWERS.adminEmail,
    adminPassword: DEFAULT_ANSWERS.adminPassword,
    notionParentPage: DEFAULT_ANSWERS.notionParentPage,
    notionSeedCount: DEFAULT_ANSWERS.notionSeedCount,
  };
}

export async function runProvisionRepair(
  context: ProjectContext,
  answers: Answers = buildRepairAnswers(context),
  options: { conflictChoice?: "apply-all" | "safe-only" } = {}
) {
  const entries = await inspectProvisionRepair(context);
  const applicable = entries.filter((entry) =>
    options.conflictChoice === "apply-all" ? true : entry.risk === "safe"
  );

  for (const entry of applicable) {
    await entry.apply();
  }

  return { answers, appliedEntries: applicable };
}
```

- [ ] **Step 5: Keep the existing provisioner reusable for real apply callbacks**

Update `packages/create-nextion-app/src/provision/index.ts` by extracting small
apply helpers that `inspect.ts` can wrap into `UnifiedUpdateEntry.apply()`:

```ts
export async function applyProvisionRepairAction(action: () => Promise<void>) {
  await action();
}
```

And make sure future `inspectProvisionRepair()` entries call the same low-level
helpers used by the current provision flow instead of duplicating shell logic.

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/provision/repair.test.ts
```

Expected:

```text
PASS for inspectable repair entries and safe-only repair application.
```

- [ ] **Step 7: Commit**

```bash
git add packages/create-nextion-app/src/provision/inspect.ts \
  packages/create-nextion-app/src/provision/index.ts \
  packages/create-nextion-app/src/provision/repair.ts \
  packages/create-nextion-app/src/provision/repair.test.ts
git commit -m "feat: inspect repair actions during update"
```

### Task 3: Route The CLI Through One Conflict-Aware Update Command

**Files:**
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/update/index.ts`
- Create: `packages/create-nextion-app/src/cli-nextion.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/create-nextion-app/src/cli-nextion.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const loadProjectContextMock = vi.hoisted(() => vi.fn());
const buildTemplatePlanMock = vi.hoisted(() => vi.fn());
const inspectProvisionRepairMock = vi.hoisted(() => vi.fn());
const runUnifiedUpdateMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const infoMock = vi.hoisted(() => vi.fn());

vi.mock("./project-context.js", () => ({
  loadProjectContext: loadProjectContextMock,
}));

vi.mock("./update/template-sync.js", () => ({
  buildUpdatePlan: buildTemplatePlanMock,
}));

vi.mock("./provision/inspect.js", () => ({
  inspectProvisionRepair: inspectProvisionRepairMock,
}));

vi.mock("./update/unified.js", () => ({
  runUnifiedUpdate: runUnifiedUpdateMock,
  formatUnifiedUpdateSummary: () => ["safe updates:", "  - file:README.md"],
}));

vi.mock("@clack/prompts", () => ({
  select: selectMock,
  log: { info: infoMock, error: vi.fn() },
}));

describe("cli nextion update", () => {
  it("runs unified update and prompts once when conflicts exist", async () => {
    loadProjectContextMock.mockResolvedValue(context);
    buildTemplatePlanMock.mockResolvedValue([
      { filePath: "wrangler.jsonc", status: "updated", nextContent: "{}\n" },
    ]);
    inspectProvisionRepairMock.mockResolvedValue([]);
    selectMock.mockResolvedValue("safe-only");
    runUnifiedUpdateMock.mockResolvedValue({
      appliedSafe: [],
      appliedConflicts: [],
      conflictsRemaining: [],
      needsInstall: false,
      compatibilityPreserved: false,
    });

    await main(["update"]);

    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(runUnifiedUpdateMock).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ conflictChoice: "safe-only" })
    );
  });

  it("rejects provision repair as an unsupported public command", async () => {
    await expect(main(["provision", "repair"])).rejects.toThrow(
      "Unsupported command: provision repair"
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/cli-nextion.test.ts
```

Expected:

```text
FAIL because main() is not exported for test use, the CLI does not inspect repair entries, and provision repair is still supported.
```

- [ ] **Step 3: Export a testable CLI main and wire unified update**

Update `packages/create-nextion-app/src/cli-nextion.ts`:

```ts
#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { loadProjectContext } from "./project-context.js";
import { inspectProvisionRepair } from "./provision/inspect.js";
import { buildUpdatePlan } from "./update/template-sync.js";
import {
  formatUnifiedUpdateSummary,
  runUnifiedUpdate,
} from "./update/unified.js";

async function chooseConflictStrategy(conflictCount: number) {
  if (conflictCount === 0) return "safe-only" as const;
  return (await p.select({
    message: `Found ${conflictCount} conflicts. How should update proceed?`,
    options: [
      { value: "apply-all", label: "Apply all conflict updates" },
      { value: "safe-only", label: "Apply only safe updates" },
      { value: "cancel", label: "Cancel" },
    ],
  })) as "apply-all" | "safe-only" | "cancel";
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, subcommand] = argv;
  const context = await loadProjectContext(process.cwd());

  if (command === "update" && !subcommand) {
    const [templateEntries, repairEntries] = await Promise.all([
      buildUpdatePlan(context),
      inspectProvisionRepair(context),
    ]);
    const conflictCount =
      templateEntries.filter((entry) => entry.status === "updated").length +
      repairEntries.filter((entry) => entry.risk === "conflict").length;
    const conflictChoice = await chooseConflictStrategy(conflictCount);
    if (conflictChoice === "cancel") return;

    const summary = await runUnifiedUpdate(context, {
      templateEntries,
      repairEntries,
      conflictChoice,
    });
    for (const line of formatUnifiedUpdateSummary(summary)) {
      p.log.info(line);
    }
    return;
  }

  throw new Error(
    `Unsupported command: ${[command, subcommand].filter(Boolean).join(" ")}`
  );
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    p.log.error(message);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/cli-nextion.test.ts src/update/update.test.ts src/provision/repair.test.ts
```

Expected:

```text
PASS for unified CLI routing, grouped conflict confirmation, and hidden provision repair entrypoint.
```

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/cli-nextion.ts \
  packages/create-nextion-app/src/cli-nextion.test.ts \
  packages/create-nextion-app/src/update/index.ts
git commit -m "feat: route update through unified maintenance flow"
```

### Task 4: Update Operator Docs And Generated Project Guidance

**Files:**
- Modify: `docs/architecture/upgrading-nextion.md`
- Modify: `packages/create-nextion-app/src/templates/README.md.tmpl`

- [ ] **Step 1: Write the failing doc assertions**

Add this test to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
it("documents update as the only public upgrade command", async () => {
  const upgradingDoc = await readFile(
    path.join(process.cwd(), "docs/architecture/upgrading-nextion.md"),
    "utf8"
  );

  expect(upgradingDoc).toContain("nextion update");
  expect(upgradingDoc).not.toContain("nextion provision repair");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/update/update.test.ts
```

Expected:

```text
FAIL because the upgrade doc still describes update and provision repair as separate commands.
```

- [ ] **Step 3: Update the docs**

Revise `docs/architecture/upgrading-nextion.md` so the opening command table
collapses into one row:

```md
| 场景 | 命令 | 默认是否改云资源 | 默认是否 deploy |
|---|---|---:|---:|
| 统一升级 Nextion 项目 | `nextion update` | 是，仅自动应用安全项；冲突项统一确认 | 否 |
```

Replace the old “高频迭代期推荐流程” with:

```md
1. 运行 `nextion update`
2. 命令自动检测项目元数据、依赖版本、Notion 资源和 Cloudflare bindings
3. 安全项自动执行
4. 冲突项统一确认
5. 只有需要验证线上环境时，再手动 deploy
```

Update `packages/create-nextion-app/src/templates/README.md.tmpl` to include a
single maintenance note:

~~~md
## Keeping The Project Updated

Run:

```bash
npx nextion update
```

The command upgrades `@notionx/core`, syncs scaffold-managed files, and repairs
safe Notion / Cloudflare drift automatically. If an update would overwrite your
customized code or populated Notion content, it will stop and ask for one
confirmation before applying those conflicts.
~~~

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/update/update.test.ts
```

Expected:

```text
PASS for the updated operator documentation assertions.
```

- [ ] **Step 5: Run package checks**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/cli-nextion.test.ts src/update/update.test.ts src/provision/repair.test.ts
pnpm --filter @notionx/create-nextion-app exec tsc --noEmit
```

Expected:

```text
PASS for the unified update tests.
PASS for package typecheck.
```

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/upgrading-nextion.md \
  packages/create-nextion-app/src/templates/README.md.tmpl \
  packages/create-nextion-app/src/update/update.test.ts
git commit -m "docs: document unified nextion update flow"
```

## Self-Review

- Spec coverage:
  - one public command `nextion update`: Task 3, Task 4
  - auto-upgrade `@notionx/core`: Task 1
  - no re-entry of Notion page ids: Task 2, Task 3
  - safe updates auto-apply: Task 1, Task 2, Task 3
  - grouped conflict confirmation: Task 1, Task 3
  - docs and generated guidance updated: Task 4
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to previous task” shortcuts remain.
- Type consistency:
  - `UnifiedUpdateEntry`, `UnifiedUpdateSummary`, `buildUnifiedUpdatePlan`, and
    `runUnifiedUpdate` are used consistently across all tasks.
