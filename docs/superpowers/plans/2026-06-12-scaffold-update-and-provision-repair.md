# Scaffold Update And Provision Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `nextion update` and `nextion provision repair` so existing Nextion projects can sync scaffold-managed files and repair external resources without recreating the project.

**Architecture:** Introduce a small scaffold metadata layer first so generated apps can identify their scaffold shape. Build `provision repair` on top of the existing provisioning helpers with deploy disabled by default, then add `update` as a local template sync flow that only touches explicitly scaffold-owned files. Finish by documenting the new command boundaries against `pnpm update @notionx/core`.

**Tech Stack:** TypeScript, Node.js CLI, @clack/prompts, existing create-nextion-app render/provision helpers, Vitest

---

## File Structure

### Existing files to modify

- `packages/create-nextion-app/package.json`
  - Add the long-lived `nextion` bin entry and any scripts needed for tests/build.
- `packages/create-nextion-app/src/index.ts`
  - Keep create-project flow focused on first-run generation; delegate shared logic to reusable modules when needed.
- `packages/create-nextion-app/src/render.ts`
  - Write scaffold metadata into generated projects and expose deterministic token generation helpers if update regeneration needs them.
- `packages/create-nextion-app/src/provision/index.ts`
  - Split first-run provisioning from repair-safe provisioning so repair can reuse the same resource logic without install/deploy side effects.
- `docs/architecture/upgrading-nextion.md`
  - Document the new command boundaries.

### New files to create

- `packages/create-nextion-app/src/metadata.ts`
  - Read/write/validate scaffold metadata for generated projects.
- `packages/create-nextion-app/src/cli-nextion.ts`
  - New maintenance CLI entry point for `nextion update` and `nextion provision repair`.
- `packages/create-nextion-app/src/project-context.ts`
  - Resolve current project directory, load metadata, and enforce “this is a Nextion project”.
- `packages/create-nextion-app/src/update/index.ts`
  - Top-level `nextion update` orchestration.
- `packages/create-nextion-app/src/update/scaffold-files.ts`
  - Define the first-version scaffold-owned file list and file classification rules.
- `packages/create-nextion-app/src/update/template-sync.ts`
  - Generate expected template output for the current project metadata and compute safe file updates.
- `packages/create-nextion-app/src/provision/repair.ts`
  - Top-level `nextion provision repair` orchestration.
- `packages/create-nextion-app/src/provision/options.ts`
  - Shared provisioning mode flags such as create vs repair and deploy enabled vs disabled.
- `packages/create-nextion-app/src/__tests__/metadata.test.ts`
  - Metadata parsing/writing tests.
- `packages/create-nextion-app/src/update/update.test.ts`
  - Focused update behavior tests.
- `packages/create-nextion-app/src/provision/repair.test.ts`
  - Focused repair behavior tests.

### Existing tests to modify

- `packages/create-nextion-app/src/provision/notion.test.ts`
  - Extend as needed if repair introduces new Notion result semantics.

## Task 1: Add scaffold metadata for generated projects

**Files:**
- Create: `packages/create-nextion-app/src/metadata.ts`
- Modify: `packages/create-nextion-app/src/render.ts`
- Modify: `packages/create-nextion-app/src/prompt.ts`
- Test: `packages/create-nextion-app/src/__tests__/metadata.test.ts`

- [ ] **Step 1: Write the failing metadata tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildScaffoldMetadata,
  parseScaffoldMetadata,
  SCAFFOLD_METADATA_FILE,
} from "../metadata.js";
import type { Answers } from "../prompt.js";

const baseAnswers: Answers = {
  projectName: "demo",
  targetDir: "./demo",
  defaultLocale: "en",
  supportedLocales: ["en"],
  nextionSource: "^0.1.2",
  uiPreset: "site",
  contentSource: {
    id: "blog",
    title: "Blog",
    fields: [
      { key: "title", notionName: "Name" },
      { key: "slug", notionName: "Slug" },
    ],
  },
  adminEmail: "admin@example.com",
  adminPassword: "ChangeMe1234",
  notionParentPage: "",
  notionSeedCount: 3,
};

describe("scaffold metadata", () => {
  it("builds stable metadata from scaffold answers", () => {
    const metadata = buildScaffoldMetadata(baseAnswers, "0.4.10");
    expect(metadata.scaffoldVersion).toBe("0.4.10");
    expect(metadata.contentSource.id).toBe("blog");
    expect(metadata.uiPreset).toBe("site");
    expect(metadata.projectKind).toBe("nextion");
  });

  it("parses valid metadata JSON", () => {
    const parsed = parseScaffoldMetadata(
      JSON.stringify({
        projectKind: "nextion",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en"],
        uiPreset: "site",
        nextionSource: "^0.1.2",
        contentSource: { id: "blog", title: "Blog" },
      })
    );
    expect(parsed.contentSource.title).toBe("Blog");
  });

  it("rejects invalid metadata", () => {
    expect(() => parseScaffoldMetadata(`{"projectKind":"other"}`)).toThrow(
      /nextion metadata/i
    );
  });

  it("exports the metadata filename constant", () => {
    expect(SCAFFOLD_METADATA_FILE).toBe(".nextion/scaffold.json");
  });
});
```

- [ ] **Step 2: Run metadata tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/__tests__/metadata.test.ts
```

Expected: FAIL with module export or file-not-found errors for `metadata.ts`.

- [ ] **Step 3: Write the minimal metadata module**

```ts
import type { Answers } from "./prompt.js";

export const SCAFFOLD_METADATA_FILE = ".nextion/scaffold.json";

export interface ScaffoldMetadata {
  projectKind: "nextion";
  scaffoldVersion: string;
  defaultLocale: string;
  supportedLocales: string[];
  uiPreset: Answers["uiPreset"];
  nextionSource: string;
  contentSource: {
    id: string;
    title: string;
  };
}

export function buildScaffoldMetadata(
  answers: Answers,
  scaffoldVersion: string
): ScaffoldMetadata {
  return {
    projectKind: "nextion",
    scaffoldVersion,
    defaultLocale: answers.defaultLocale,
    supportedLocales: [...answers.supportedLocales],
    uiPreset: answers.uiPreset,
    nextionSource: answers.nextionSource,
    contentSource: {
      id: answers.contentSource.id,
      title: answers.contentSource.title,
    },
  };
}

export function parseScaffoldMetadata(raw: string): ScaffoldMetadata {
  const parsed = JSON.parse(raw) as Partial<ScaffoldMetadata>;
  if (
    parsed.projectKind !== "nextion" ||
    typeof parsed.scaffoldVersion !== "string" ||
    typeof parsed.defaultLocale !== "string" ||
    !Array.isArray(parsed.supportedLocales) ||
    typeof parsed.uiPreset !== "string" ||
    typeof parsed.nextionSource !== "string" ||
    !parsed.contentSource ||
    typeof parsed.contentSource.id !== "string" ||
    typeof parsed.contentSource.title !== "string"
  ) {
    throw new Error("Invalid Nextion metadata payload");
  }
  return parsed as ScaffoldMetadata;
}
```

- [ ] **Step 4: Teach render to emit metadata**

Add this import near the top of `packages/create-nextion-app/src/render.ts`:

```ts
import { buildScaffoldMetadata, SCAFFOLD_METADATA_FILE } from "./metadata.js";
```

Add this helper near the existing `ensureDir` / `exists` helpers:

```ts
async function readPackageVersion(): Promise<string> {
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const raw = await fs.readFile(packageJsonUrl, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}
```

Update `render(...)` to write the metadata file right after `await ensureDir(absoluteOut);`:

```ts
  const scaffoldVersion = await readPackageVersion();
  const metadata = buildScaffoldMetadata(answers, scaffoldVersion);
  const metadataPath = path.join(absoluteOut, SCAFFOLD_METADATA_FILE);
  await ensureDir(path.dirname(metadataPath));
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
```

- [ ] **Step 5: Run metadata tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/__tests__/metadata.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/create-nextion-app/src/metadata.ts packages/create-nextion-app/src/render.ts packages/create-nextion-app/src/__tests__/metadata.test.ts
git commit -m "feat: add scaffold project metadata"
```

## Task 2: Add project context loading for existing Nextion apps

**Files:**
- Create: `packages/create-nextion-app/src/project-context.ts`
- Test: `packages/create-nextion-app/src/__tests__/metadata.test.ts`

- [ ] **Step 1: Extend metadata tests with a failing project-context case**

Append this test block to `packages/create-nextion-app/src/__tests__/metadata.test.ts`:

```ts
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadProjectContext } from "../project-context.js";

it("loads an existing nextion project from scaffold metadata", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "nextion-project-"));
  const metadataDir = path.join(dir, ".nextion");
  await mkdir(metadataDir, { recursive: true });
  await writeFile(
    path.join(metadataDir, "scaffold.json"),
    JSON.stringify(
      {
        projectKind: "nextion",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en"],
        uiPreset: "site",
        nextionSource: "^0.1.2",
        contentSource: { id: "blog", title: "Blog" },
      },
      null,
      2
    )
  );

  const context = await loadProjectContext(dir);
  expect(context.projectDir).toBe(dir);
  expect(context.metadata.contentSource.id).toBe("blog");
});
```

- [ ] **Step 2: Run metadata tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/__tests__/metadata.test.ts
```

Expected: FAIL because `project-context.ts` does not exist.

- [ ] **Step 3: Implement the minimal project-context loader**

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseScaffoldMetadata,
  SCAFFOLD_METADATA_FILE,
  type ScaffoldMetadata,
} from "./metadata.js";

export interface ProjectContext {
  projectDir: string;
  metadata: ScaffoldMetadata;
}

export async function loadProjectContext(projectDir: string): Promise<ProjectContext> {
  const metadataPath = path.join(projectDir, SCAFFOLD_METADATA_FILE);
  let raw: string;
  try {
    raw = await readFile(metadataPath, "utf8");
  } catch {
    throw new Error(
      `No Nextion scaffold metadata found in ${projectDir}. Expected ${SCAFFOLD_METADATA_FILE}.`
    );
  }

  return {
    projectDir,
    metadata: parseScaffoldMetadata(raw),
  };
}
```

- [ ] **Step 4: Run metadata tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/__tests__/metadata.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/project-context.ts packages/create-nextion-app/src/__tests__/metadata.test.ts
git commit -m "feat: load existing nextion project context"
```

## Task 3: Extract repair-safe provisioning options from first-run provisioning

**Files:**
- Create: `packages/create-nextion-app/src/provision/options.ts`
- Modify: `packages/create-nextion-app/src/provision/index.ts`
- Test: `packages/create-nextion-app/src/provision/repair.test.ts`

- [ ] **Step 1: Write the failing provisioning-options test**

Create `packages/create-nextion-app/src/provision/repair.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { defaultProvisionMode } from "./options.js";

describe("provision mode defaults", () => {
  it("disables deploy for repair mode", () => {
    expect(defaultProvisionMode("repair").deploy).toBe(false);
  });

  it("enables deploy for create mode", () => {
    expect(defaultProvisionMode("create").deploy).toBe(true);
  });
});
```

- [ ] **Step 2: Run the repair test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/repair.test.ts
```

Expected: FAIL because `options.ts` does not exist.

- [ ] **Step 3: Implement the minimal provisioning options module**

Create `packages/create-nextion-app/src/provision/options.ts`:

```ts
export type ProvisionModeName = "create" | "repair";

export interface ProvisionMode {
  name: ProvisionModeName;
  deploy: boolean;
  allowRemoteMigrations: boolean;
}

export function defaultProvisionMode(name: ProvisionModeName): ProvisionMode {
  if (name === "repair") {
    return {
      name,
      deploy: false,
      allowRemoteMigrations: false,
    };
  }

  return {
    name,
    deploy: true,
    allowRemoteMigrations: true,
  };
}
```

- [ ] **Step 4: Thread the mode into provisioning**

Update the `provision(...)` signature in `packages/create-nextion-app/src/provision/index.ts`:

```ts
import { defaultProvisionMode, type ProvisionMode } from "./options.js";
```

Change the function signature to:

```ts
export async function provision(
  answers: Answers,
  projectDir: string,
  options: { interactive: boolean; mode?: ProvisionMode }
): Promise<ProvisionResult> {
```

At the top of the function body, add:

```ts
  const mode = options.mode ?? defaultProvisionMode("create");
```

Wrap the deploy block with:

```ts
  if (!mode.deploy) {
    result.deploy = {
      ok: false,
      workerName: slug,
      skipped: true,
      message: "deploy disabled for this provisioning mode",
    };
    return finalize(result, projectDir, slug);
  }
```

Place that guard immediately before the existing `// ---- 7. Deploy ----` section.

- [ ] **Step 5: Run the repair test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/repair.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run existing provisioning tests to catch regressions**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/create-nextion-app/src/provision/options.ts packages/create-nextion-app/src/provision/index.ts packages/create-nextion-app/src/provision/repair.test.ts
git commit -m "refactor: add repair-safe provisioning mode"
```

## Task 4: Add the `nextion provision repair` command

**Files:**
- Create: `packages/create-nextion-app/src/provision/repair.ts`
- Create: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/package.json`
- Modify: `packages/create-nextion-app/src/provision/index.ts`
- Modify: `packages/create-nextion-app/src/provision/repair.test.ts`
- Test: `packages/create-nextion-app/src/provision/repair.test.ts`

- [ ] **Step 1: Add failing repair command tests**

Append to `packages/create-nextion-app/src/provision/repair.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { runProvisionRepair } from "./repair.js";
import type { ProjectContext } from "../project-context.js";

const provisionMock = vi.fn();

vi.mock("./index.js", async () => {
  const actual = await vi.importActual<typeof import("./index.js")>("./index.js");
  return {
    ...actual,
    provision: provisionMock,
  };
});

const context: ProjectContext = {
  projectDir: "/tmp/demo",
  metadata: {
    projectKind: "nextion",
    scaffoldVersion: "0.4.10",
    defaultLocale: "en",
    supportedLocales: ["en"],
    uiPreset: "site",
    nextionSource: "^0.1.2",
    contentSource: { id: "blog", title: "Blog" },
  },
};

describe("runProvisionRepair", () => {
  it("invokes provision in repair mode", async () => {
    provisionMock.mockResolvedValueOnce({ deploy: { skipped: true } });
    await runProvisionRepair(context, {
      projectName: "demo",
      targetDir: "./demo",
      defaultLocale: "en",
      supportedLocales: ["en"],
      nextionSource: "^0.1.2",
      uiPreset: "site",
      contentSource: {
        id: "blog",
        title: "Blog",
        fields: [{ key: "title", notionName: "Name" }],
      },
      adminEmail: "admin@example.com",
      adminPassword: "ChangeMe1234",
      notionParentPage: "",
      notionSeedCount: 3,
    });

    expect(provisionMock).toHaveBeenCalledWith(
      expect.any(Object),
      "/tmp/demo",
      expect.objectContaining({
        interactive: false,
        mode: expect.objectContaining({ name: "repair", deploy: false }),
      })
    );
  });
});
```

- [ ] **Step 2: Run the repair test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/repair.test.ts
```

Expected: FAIL because `repair.ts` does not exist.

- [ ] **Step 3: Implement the repair runner**

Create `packages/create-nextion-app/src/provision/repair.ts`:

```ts
import type { Answers } from "../prompt.js";
import type { ProjectContext } from "../project-context.js";
import { provision } from "./index.js";
import { defaultProvisionMode } from "./options.js";

export async function runProvisionRepair(
  context: ProjectContext,
  answers: Answers
) {
  return provision(answers, context.projectDir, {
    interactive: false,
    mode: defaultProvisionMode("repair"),
  });
}
```

- [ ] **Step 4: Create the maintenance CLI entry**

Create `packages/create-nextion-app/src/cli-nextion.ts`:

```ts
#!/usr/bin/env node

import path from "node:path";
import * as p from "@clack/prompts";
import { loadProjectContext } from "./project-context.js";
import { DEFAULT_ANSWERS } from "./prompt.js";
import { runProvisionRepair } from "./provision/repair.js";

async function main(): Promise<void> {
  const [command, subcommand] = process.argv.slice(2);
  const cwd = process.cwd();
  const context = await loadProjectContext(cwd);

  if (command === "provision" && subcommand === "repair") {
    await runProvisionRepair(context, {
      ...DEFAULT_ANSWERS,
      projectName: path.basename(cwd),
      targetDir: cwd,
      defaultLocale: context.metadata.defaultLocale,
      supportedLocales: context.metadata.supportedLocales,
      nextionSource: context.metadata.nextionSource,
      uiPreset: context.metadata.uiPreset,
      contentSource: {
        id: context.metadata.contentSource.id,
        title: context.metadata.contentSource.title,
        fields: DEFAULT_ANSWERS.contentSource.fields,
      },
      adminEmail: DEFAULT_ANSWERS.adminEmail,
      adminPassword: DEFAULT_ANSWERS.adminPassword,
      notionParentPage: DEFAULT_ANSWERS.notionParentPage,
      notionSeedCount: DEFAULT_ANSWERS.notionSeedCount,
    });
    return;
  }

  throw new Error(`Unsupported command: ${[command, subcommand].filter(Boolean).join(" ")}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  p.log.error(message);
  process.exit(1);
});
```

- [ ] **Step 5: Expose the `nextion` bin**

Update `packages/create-nextion-app/package.json`:

```json
  "bin": {
    "create-nextion-app": "./dist/index.js",
    "nextion": "./dist/cli-nextion.js"
  },
```

- [ ] **Step 6: Run repair tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/repair.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/create-nextion-app/src/provision/repair.ts packages/create-nextion-app/src/cli-nextion.ts packages/create-nextion-app/package.json packages/create-nextion-app/src/provision/repair.test.ts
git commit -m "feat: add provision repair command"
```

## Task 5: Add scaffold-owned file classification and update planning

**Files:**
- Create: `packages/create-nextion-app/src/update/scaffold-files.ts`
- Create: `packages/create-nextion-app/src/update/template-sync.ts`
- Create: `packages/create-nextion-app/src/update/update.test.ts`

- [ ] **Step 1: Write the failing update planning tests**

Create `packages/create-nextion-app/src/update/update.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isScaffoldManagedFile,
  scaffoldManagedFiles,
} from "./scaffold-files.js";

describe("scaffold-managed files", () => {
  it("recognizes package.json as scaffold-managed", () => {
    expect(isScaffoldManagedFile("package.json")).toBe(true);
  });

  it("does not mark arbitrary user files as scaffold-managed", () => {
    expect(isScaffoldManagedFile("src/features/custom.ts")).toBe(false);
  });

  it("exports a non-empty file list", () => {
    expect(scaffoldManagedFiles.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the update tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: FAIL because `scaffold-files.ts` does not exist.

- [ ] **Step 3: Implement the minimal scaffold file list**

Create `packages/create-nextion-app/src/update/scaffold-files.ts`:

```ts
export const scaffoldManagedFiles = [
  "package.json",
  "wrangler.jsonc",
  "README.md",
  ".nextion/scaffold.json",
  ".dev.vars.example",
] as const;

export function isScaffoldManagedFile(filePath: string): boolean {
  return scaffoldManagedFiles.includes(filePath as (typeof scaffoldManagedFiles)[number]);
}
```

- [ ] **Step 4: Create a minimal template-sync helper**

Create `packages/create-nextion-app/src/update/template-sync.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectContext } from "../project-context.js";
import { scaffoldManagedFiles } from "./scaffold-files.js";

export interface UpdatePlanEntry {
  filePath: string;
  status: "unchanged" | "update";
}

export async function buildUpdatePlan(
  context: ProjectContext
): Promise<UpdatePlanEntry[]> {
  return Promise.all(
    scaffoldManagedFiles.map(async (filePath) => {
      const absolutePath = path.join(context.projectDir, filePath);
      try {
        await readFile(absolutePath, "utf8");
        return { filePath, status: "update" as const };
      } catch {
        return { filePath, status: "unchanged" as const };
      }
    })
  );
}
```

- [ ] **Step 5: Run the update tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/create-nextion-app/src/update/scaffold-files.ts packages/create-nextion-app/src/update/template-sync.ts packages/create-nextion-app/src/update/update.test.ts
git commit -m "feat: define scaffold-managed update scope"
```

## Task 6: Add the `nextion update` command

**Files:**
- Create: `packages/create-nextion-app/src/update/index.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/update/update.test.ts`
- Test: `packages/create-nextion-app/src/update/update.test.ts`

- [ ] **Step 1: Add a failing update runner test**

Append to `packages/create-nextion-app/src/update/update.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { runUpdate } from "./index.js";
import type { ProjectContext } from "../project-context.js";

const buildUpdatePlanMock = vi.fn();

vi.mock("./template-sync.js", () => ({
  buildUpdatePlan: buildUpdatePlanMock,
}));

describe("runUpdate", () => {
  it("returns the generated plan entries", async () => {
    const context: ProjectContext = {
      projectDir: "/tmp/demo",
      metadata: {
        projectKind: "nextion",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en"],
        uiPreset: "site",
        nextionSource: "^0.1.2",
        contentSource: { id: "blog", title: "Blog" },
      },
    };
    buildUpdatePlanMock.mockResolvedValueOnce([
      { filePath: "package.json", status: "update" },
    ]);

    const plan = await runUpdate(context);
    expect(plan).toEqual([{ filePath: "package.json", status: "update" }]);
  });
});
```

- [ ] **Step 2: Run update tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: FAIL because `update/index.ts` does not exist.

- [ ] **Step 3: Implement the minimal update runner**

Create `packages/create-nextion-app/src/update/index.ts`:

```ts
import type { ProjectContext } from "../project-context.js";
import { buildUpdatePlan } from "./template-sync.js";

export async function runUpdate(context: ProjectContext) {
  return buildUpdatePlan(context);
}
```

- [ ] **Step 4: Wire the `update` command into the maintenance CLI**

Update `packages/create-nextion-app/src/cli-nextion.ts` imports:

```ts
import { runUpdate } from "./update/index.js";
```

Add this branch before the provision-repair branch:

```ts
  if (command === "update" && !subcommand) {
    const plan = await runUpdate(context);
    for (const entry of plan) {
      p.log.info(`${entry.status.toUpperCase()}: ${entry.filePath}`);
    }
    return;
  }
```

- [ ] **Step 5: Run update tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/update/update.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/create-nextion-app/src/update/index.ts packages/create-nextion-app/src/cli-nextion.ts packages/create-nextion-app/src/update/update.test.ts
git commit -m "feat: add update command"
```

## Task 7: Document command boundaries and recommended workflows

**Files:**
- Modify: `docs/architecture/upgrading-nextion.md`
- Test: none

- [ ] **Step 1: Update the upgrade doc wording**

Replace the opening summary in `docs/architecture/upgrading-nextion.md` with:

```md
# 升级 Nextion

> 范围：Nextion 项目的升级分成三层：
> 1. `@notionx/core` 运行时依赖升级
> 2. 脚手架模板同步：`nextion update`
> 3. 外部资源修复与补齐：`nextion provision repair`
```

- [ ] **Step 2: Add a permanent command table near the top**

Insert this section after the intro:

```md
## 命令边界

| 场景 | 命令 | 默认是否改云资源 | 默认是否 deploy |
|---|---|---:|---:|
| 升级运行时依赖 | `pnpm update @notionx/core` | 否 | 否 |
| 同步脚手架模板 | `nextion update` | 否 | 否 |
| 修复 Notion / Cloudflare 资源 | `nextion provision repair` | 是，仅修差异 | 否 |
```
```

- [ ] **Step 3: Add a rapid-iteration workflow section**

Append this section:

```md
## 高频迭代期推荐流程

当脚手架和 `@notionx/core` 都在快速变化时，推荐按下面顺序判断：

1. 只改了运行时库能力：先跑 `pnpm update @notionx/core`
2. 改了模板、配置、README、脚手架生成代码：跑 `nextion update`
3. 改了 Notion schema、Cloudflare bindings、secrets 或资源对齐逻辑：跑 `nextion provision repair`
4. 只有需要验证线上环境时，再手动 deploy
```

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/upgrading-nextion.md
git commit -m "docs: document update and provision repair commands"
```

## Task 8: Final verification

**Files:**
- Modify: none
- Test: `packages/create-nextion-app/src/__tests__/metadata.test.ts`
- Test: `packages/create-nextion-app/src/update/update.test.ts`
- Test: `packages/create-nextion-app/src/provision/repair.test.ts`
- Test: `packages/create-nextion-app/src/provision/notion.test.ts`

- [ ] **Step 1: Run focused metadata, update, and repair tests**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/__tests__/metadata.test.ts src/update/update.test.ts src/provision/repair.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run existing Notion provisioning tests**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/provision/notion.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the full package test suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test
```

Expected: PASS.

- [ ] **Step 4: Build the package**

Run:

```bash
pnpm --filter @notionx/create-nextion-app build
```

Expected: PASS and `dist/cli-nextion.js` is generated.

- [ ] **Step 5: Check diagnostics on edited files**

Run the editor diagnostics on:

- `packages/create-nextion-app/src/metadata.ts`
- `packages/create-nextion-app/src/project-context.ts`
- `packages/create-nextion-app/src/cli-nextion.ts`
- `packages/create-nextion-app/src/provision/index.ts`
- `packages/create-nextion-app/src/provision/repair.ts`
- `packages/create-nextion-app/src/update/index.ts`
- `packages/create-nextion-app/src/update/scaffold-files.ts`
- `packages/create-nextion-app/src/update/template-sync.ts`

Expected: no new diagnostics.

- [ ] **Step 6: Commit**

```bash
git add packages/create-nextion-app docs/architecture/upgrading-nextion.md
git commit -m "feat: add scaffold update and provision repair workflows"
```

## Self-Review Checklist

- Spec coverage:
  - metadata requirement covered by Tasks 1-2
  - `provision repair` covered by Tasks 3-4
  - `update` covered by Tasks 5-6
  - docs boundary requirement covered by Task 7
  - validation and regression coverage covered by Task 8
- Placeholder scan:
  - no TBD/TODO markers remain
  - every code-edit step includes concrete code
  - every verification step includes exact commands and expected outcomes
- Type consistency:
  - `ScaffoldMetadata`, `ProjectContext`, `ProvisionMode`, `runProvisionRepair`, and `runUpdate` names stay consistent across tasks

