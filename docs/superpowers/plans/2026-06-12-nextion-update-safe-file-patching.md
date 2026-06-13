# Nextion Update Safe File Patching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `nextion update` from a plan-only command into a safe full-file updater for a strict allowlist of scaffold-owned files.

**Architecture:** Reuse scaffold metadata to rebuild the latest expected template output in a temporary directory, compare only the allowlisted files, and then overwrite only changed or missing scaffold-owned files. Keep all update logic isolated in `src/update/*`, keep `provision repair` unchanged, and make the CLI print a clear status summary plus a `pnpm install` hint when `package.json` changes.

**Tech Stack:** TypeScript, Node.js fs/path/os APIs, existing `render()` pipeline, Vitest, @clack/prompts

---

## File Structure

### Existing files to modify

- `packages/create-nextion-app/src/render.ts`
  - Export a reusable templates-dir resolver or helper needed by update re-rendering without duplicating create-path logic.
- `packages/create-nextion-app/src/update/scaffold-files.ts`
  - Keep the authoritative allowlist for full-file updates.
- `packages/create-nextion-app/src/update/template-sync.ts`
  - Replace the placeholder plan builder with temp render, compare, and write logic.
- `packages/create-nextion-app/src/update/index.ts`
  - Orchestrate update execution and return grouped status results.
- `packages/create-nextion-app/src/cli-nextion.ts`
  - Print grouped summary output for update results and `pnpm install` hint.
- `docs/architecture/upgrading-nextion.md`
  - Clarify that `nextion update` now performs safe full-file replacement for scaffold-owned files.

### New files to create

- `packages/create-nextion-app/src/update/update-answers.ts`
  - Convert scaffold metadata into a renderable `Answers` object for update flows.

### Existing tests to modify

- `packages/create-nextion-app/src/update/update.test.ts`
  - Expand from allowlist smoke tests into temp render, compare, overwrite, and summary tests.

## Task 1: Build update answers from scaffold metadata

**Files:**
- Create: `packages/create-nextion-app/src/update/update-answers.ts`
- Modify: `packages/create-nextion-app/src/update/update.test.ts`
- Test: `packages/create-nextion-app/src/update/update.test.ts`

- [ ] **Step 1: Write the failing test for metadata-to-answers conversion**

Append this block to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
import { buildUpdateAnswers } from "./update-answers.js";

describe("buildUpdateAnswers", () => {
  it("reconstructs renderable answers from project metadata", () => {
    const answers = buildUpdateAnswers({
      projectDir: "/tmp/demo",
      metadata: {
        projectKind: "nextion",
        projectName: "demo",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en", "zh-CN"],
        uiPreset: "site",
        nextionSource: "^0.1.2",
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
    });

    expect(answers.projectName).toBe("demo");
    expect(answers.targetDir).toBe("/tmp/demo");
    expect(answers.supportedLocales).toEqual(["en", "zh-CN"]);
    expect(answers.contentSource.fields).toEqual([
      { key: "title", notionName: "Name" },
    ]);
  });
});
```

- [ ] **Step 2: Run the update test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: FAIL because `update-answers.ts` does not exist.

- [ ] **Step 3: Implement the minimal answer builder**

Create `packages/create-nextion-app/src/update/update-answers.ts`:

```ts
import { DEFAULT_ANSWERS, type Answers } from "../prompt.js";
import type { ProjectContext } from "../project-context.js";

export function buildUpdateAnswers(context: ProjectContext): Answers {
  return {
    projectName: context.metadata.projectName,
    targetDir: context.projectDir,
    defaultLocale: context.metadata.defaultLocale,
    supportedLocales: [...context.metadata.supportedLocales],
    nextionSource: context.metadata.nextionSource,
    uiPreset: context.metadata.uiPreset,
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
```

- [ ] **Step 4: Run the update test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/update/update-answers.ts packages/create-nextion-app/src/update/update.test.ts
git commit -m "feat: reconstruct update answers from scaffold metadata"
```

## Task 2: Add reusable template resolution for update rendering

**Files:**
- Modify: `packages/create-nextion-app/src/render.ts`
- Modify: `packages/create-nextion-app/src/update/update.test.ts`
- Test: `packages/create-nextion-app/src/update/update.test.ts`

- [ ] **Step 1: Write the failing helper test**

Append this block to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
import { resolveTemplatesDir } from "../render.js";

describe("resolveTemplatesDir", () => {
  it("resolves a usable templates directory", async () => {
    const templatesDir = await resolveTemplatesDir();
    expect(templatesDir.endsWith("templates")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the update test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: FAIL because `resolveTemplatesDir` is not exported.

- [ ] **Step 3: Export the reusable templates-dir helper**

Add this export to `packages/create-nextion-app/src/render.ts`:

```ts
export async function resolveTemplatesDir(): Promise<string> {
  const compiled = path.resolve(import.meta.dirname, "templates");
  const fromSource = path.resolve(import.meta.dirname, "..", "src", "templates");
  return (await exists(compiled)) ? compiled : fromSource;
}
```

Update the create-path usage in `render.ts` callers to reuse that helper if needed rather than duplicating path logic.

- [ ] **Step 4: Run the update test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/render.ts packages/create-nextion-app/src/update/update.test.ts
git commit -m "refactor: expose reusable template resolution for update"
```

## Task 3: Generate and compare allowlisted files from a temp render

**Files:**
- Modify: `packages/create-nextion-app/src/update/template-sync.ts`
- Modify: `packages/create-nextion-app/src/update/update.test.ts`
- Create: `packages/create-nextion-app/src/update/update-answers.ts`
- Test: `packages/create-nextion-app/src/update/update.test.ts`

- [ ] **Step 1: Write the failing temp-render comparison test**

Append this block to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildUpdatePlan } from "./template-sync.js";

describe("buildUpdatePlan", () => {
  it("marks changed and missing scaffold-owned files from temp scaffold output", async () => {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), "nextion-update-project-"));
    await mkdir(path.join(projectDir, ".nextion"), { recursive: true });
    await writeFile(path.join(projectDir, "package.json"), '{"name":"old"}\n', "utf8");
    await writeFile(
      path.join(projectDir, ".nextion", "scaffold.json"),
      JSON.stringify(
        {
          projectKind: "nextion",
          projectName: "demo",
          scaffoldVersion: "0.4.10",
          defaultLocale: "en",
          supportedLocales: ["en"],
          uiPreset: "site",
          nextionSource: "^0.1.2",
          contentSource: {
            id: "blog",
            title: "Blog",
            fields: [{ key: "title", notionName: "Name" }],
          },
        },
        null,
        2
      ),
      "utf8"
    );

    const plan = await buildUpdatePlan({
      projectDir,
      metadata: {
        projectKind: "nextion",
        projectName: "demo",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en"],
        uiPreset: "site",
        nextionSource: "^0.1.2",
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
    });

    expect(plan.some((entry) => entry.filePath === "package.json")).toBe(true);
    expect(
      plan.some((entry) => entry.filePath === "README.md" && entry.status === "missing")
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the update test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: FAIL because `buildUpdatePlan` does not yet render templates or produce `missing`.

- [ ] **Step 3: Replace placeholder plan logic with temp render + compare**

Replace `packages/create-nextion-app/src/update/template-sync.ts` with:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { render, resolveTemplatesDir } from "../render.js";
import type { ProjectContext } from "../project-context.js";
import { scaffoldManagedFiles } from "./scaffold-files.js";
import { buildUpdateAnswers } from "./update-answers.js";

export interface UpdatePlanEntry {
  filePath: string;
  status: "updated" | "unchanged" | "missing" | "skipped";
  nextContent?: string;
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function buildUpdatePlan(
  context: ProjectContext
): Promise<UpdatePlanEntry[]> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "nextion-update-"));
  try {
    const templatesDir = await resolveTemplatesDir();
    const answers = buildUpdateAnswers(context);
    await render(answers, templatesDir, tempRoot);

    return Promise.all(
      scaffoldManagedFiles.map(async (filePath) => {
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
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run the update test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/update/template-sync.ts packages/create-nextion-app/src/update/update.test.ts packages/create-nextion-app/src/update/update-answers.ts
git commit -m "feat: generate update plan from temp scaffold render"
```

## Task 4: Apply changed and missing scaffold-owned files

**Files:**
- Modify: `packages/create-nextion-app/src/update/index.ts`
- Modify: `packages/create-nextion-app/src/update/template-sync.ts`
- Modify: `packages/create-nextion-app/src/update/update.test.ts`
- Test: `packages/create-nextion-app/src/update/update.test.ts`

- [ ] **Step 1: Write the failing apply-update test**

Append this block to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
import { runUpdate } from "./index.js";

describe("runUpdate", () => {
  it("writes updated scaffold-owned files and leaves others untouched", async () => {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), "nextion-run-update-"));
    await mkdir(path.join(projectDir, ".nextion"), { recursive: true });
    await writeFile(path.join(projectDir, "package.json"), '{"name":"old"}\n', "utf8");
    await writeFile(path.join(projectDir, "custom.txt"), "keep me\n", "utf8");

    const summary = await runUpdate({
      projectDir,
      metadata: {
        projectKind: "nextion",
        projectName: "demo",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en"],
        uiPreset: "site",
        nextionSource: "^0.1.2",
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
    });

    const updatedPackageJson = await readFile(path.join(projectDir, "package.json"), "utf8");
    const custom = await readFile(path.join(projectDir, "custom.txt"), "utf8");

    expect(summary.updated.some((entry) => entry.filePath === "package.json")).toBe(true);
    expect(custom).toBe("keep me\n");
    expect(updatedPackageJson).not.toBe('{"name":"old"}\n');
  });
});
```

- [ ] **Step 2: Run the update test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: FAIL because `runUpdate` only returns a plan and does not write files.

- [ ] **Step 3: Implement file writes and grouped summary output**

Replace `packages/create-nextion-app/src/update/index.ts` with:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectContext } from "../project-context.js";
import { buildUpdatePlan, type UpdatePlanEntry } from "./template-sync.js";

export interface UpdateSummary {
  updated: UpdatePlanEntry[];
  missing: UpdatePlanEntry[];
  unchanged: UpdatePlanEntry[];
  skipped: UpdatePlanEntry[];
  needsInstall: boolean;
}

export async function runUpdate(context: ProjectContext): Promise<UpdateSummary> {
  const plan = await buildUpdatePlan(context);
  const summary: UpdateSummary = {
    updated: [],
    missing: [],
    unchanged: [],
    skipped: [],
    needsInstall: false,
  };

  for (const entry of plan) {
    if ((entry.status === "updated" || entry.status === "missing") && entry.nextContent !== undefined) {
      const filePath = path.join(context.projectDir, entry.filePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, entry.nextContent, "utf8");
      summary[entry.status].push(entry);
      if (entry.filePath === "package.json") {
        summary.needsInstall = true;
      }
      continue;
    }

    if (entry.status === "unchanged") {
      summary.unchanged.push(entry);
      continue;
    }

    summary.skipped.push(entry);
  }

  return summary;
}
```

- [ ] **Step 4: Run the update test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/update/index.ts packages/create-nextion-app/src/update/update.test.ts
git commit -m "feat: apply safe scaffold-owned update writes"
```

## Task 5: Print grouped CLI summary and install hint

**Files:**
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/update/update.test.ts`
- Test: `packages/create-nextion-app/src/update/update.test.ts`

- [ ] **Step 1: Write the failing CLI summary test**

Append this block to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
import { formatUpdateSummary } from "../cli-nextion.js";

describe("formatUpdateSummary", () => {
  it("includes grouped statuses and install hint", () => {
    const output = formatUpdateSummary({
      updated: [{ filePath: "package.json", status: "updated", nextContent: "{}" }],
      missing: [{ filePath: "README.md", status: "missing", nextContent: "# Demo" }],
      unchanged: [{ filePath: "wrangler.jsonc", status: "unchanged", nextContent: "{}" }],
      skipped: [{ filePath: ".dev.vars.example", status: "skipped" }],
      needsInstall: true,
    });

    expect(output).toContain("updated");
    expect(output).toContain("package.json");
    expect(output).toContain("pnpm install");
  });
});
```

- [ ] **Step 2: Run the update test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: FAIL because `formatUpdateSummary` does not exist.

- [ ] **Step 3: Add CLI summary formatting**

Replace the update branch in `packages/create-nextion-app/src/cli-nextion.ts` with:

```ts
import type { UpdateSummary } from "./update/index.js";
```

Add this helper above `main()`:

```ts
export function formatUpdateSummary(summary: UpdateSummary): string[] {
  const lines: string[] = [];
  const pushGroup = (label: string, entries: Array<{ filePath: string }>) => {
    if (entries.length === 0) return;
    lines.push(`${label}:`);
    for (const entry of entries) {
      lines.push(`  - ${entry.filePath}`);
    }
  };

  pushGroup("updated", summary.updated);
  pushGroup("missing", summary.missing);
  pushGroup("unchanged", summary.unchanged);
  pushGroup("skipped", summary.skipped);

  if (summary.needsInstall) {
    lines.push("follow-up:");
    lines.push("  - run `pnpm install`");
  }

  return lines;
}
```

Update the `update` branch:

```ts
  if (command === "update" && !subcommand) {
    const summary = await runUpdate(context);
    for (const line of formatUpdateSummary(summary)) {
      p.log.info(line);
    }
    return;
  }
```

- [ ] **Step 4: Run the update test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/cli-nextion.ts packages/create-nextion-app/src/update/update.test.ts
git commit -m "feat: print grouped update summary"
```

## Task 6: Document the new concrete update behavior

**Files:**
- Modify: `docs/architecture/upgrading-nextion.md`

- [ ] **Step 1: Add a concrete note under the command boundary section**

Insert this paragraph after the command table in `docs/architecture/upgrading-nextion.md`:

```md
当前 `nextion update` 的首版只会安全地全量替换少量脚手架拥有文件：
`package.json`、`wrangler.jsonc`、`README.md`、`.nextion/scaffold.json`、
`.dev.vars.example`。它不会改 `app/**`、`components/**` 或业务代码，也不会
自动触发 `nextion provision repair`。
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/upgrading-nextion.md
git commit -m "docs: describe safe file patching for nextion update"
```

## Task 7: Final verification

**Files:**
- Test: `packages/create-nextion-app/src/update/update.test.ts`
- Test: `packages/create-nextion-app/src/__tests__/metadata.test.ts`
- Test: `packages/create-nextion-app/src/provision/repair.test.ts`
- Test: `packages/create-nextion-app/src/provision/notion.test.ts`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts src/__tests__/metadata.test.ts src/provision/repair.test.ts src/provision/notion.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run package type checking**

Run:

```bash
cd packages/create-nextion-app && npx tsc -p tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 3: Check diagnostics on edited files**

Run diagnostics on:

- `packages/create-nextion-app/src/update/update-answers.ts`
- `packages/create-nextion-app/src/update/template-sync.ts`
- `packages/create-nextion-app/src/update/index.ts`
- `packages/create-nextion-app/src/cli-nextion.ts`
- `packages/create-nextion-app/src/render.ts`
- `packages/create-nextion-app/src/update/update.test.ts`

Expected: no new diagnostics.

- [ ] **Step 4: Commit**

```bash
git add packages/create-nextion-app docs/architecture/upgrading-nextion.md
git commit -m "feat: apply safe scaffold-owned updates"
```

## Self-Review Checklist

- Spec coverage:
  - temp render from metadata covered by Tasks 1-3
  - allowlist-only comparison and full-file overwrite covered by Tasks 3-4
  - grouped summary and install hint covered by Task 5
  - docs boundary covered by Task 6
  - validation covered by Task 7
- Placeholder scan:
  - no TBD/TODO markers remain
  - every code step includes concrete code
  - every verification step includes exact commands
- Type consistency:
  - `buildUpdateAnswers`, `UpdatePlanEntry`, `UpdateSummary`, and `formatUpdateSummary` are used consistently across tasks
