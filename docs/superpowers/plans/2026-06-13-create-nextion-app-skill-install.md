# Create Nextion App Skill Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `nextion` skill install step to `create-nextion-app` with interactive auto-detect-and-ask behavior and explicit non-interactive overrides.

**Architecture:** Introduce a small `skill-install/` module in `packages/create-nextion-app/src` that owns parsing, detection, prompting, installer invocation, and outcome formatting. Keep the existing create flow intact by threading resolved skill-install intent through `answers.ts` / `prompt.ts`, then run the installer after project render in `index.ts` as a best-effort post-create step.

**Tech Stack:** TypeScript, Node.js child processes and fs APIs, `@clack/prompts`, Vitest

---

## File Structure

- Create: `packages/create-nextion-app/src/skill-install/types.ts`
  - Shared types for install mode, target, detection results, resolved execution plan, and install outcomes.
- Create: `packages/create-nextion-app/src/skill-install/detect.ts`
  - Conservative best-effort detection of likely `trae`, `claude`, and `codex` targets.
- Create: `packages/create-nextion-app/src/skill-install/install.ts`
  - Resolution of CLI/interactive behavior plus installer execution via `npx @notionx/skill`.
- Create: `packages/create-nextion-app/src/skill-install/detect.test.ts`
  - Unit tests for detection logic and target ordering.
- Create: `packages/create-nextion-app/src/skill-install/install.test.ts`
  - Unit tests for mode resolution, prompt gating, command construction, and failure handling.
- Modify: `packages/create-nextion-app/src/prompt.ts`
  - Extend the interactive answers shape to carry skill install intent and insert the optional prompt flow.
- Modify: `packages/create-nextion-app/src/answers.ts`
  - Parse `--install-skill`, apply interactive/non-interactive defaults, and expose resolved skill-install config to callers.
- Modify: `packages/create-nextion-app/src/index.ts`
  - Call the installer after render, log non-blocking warnings, and include retry guidance.
- Modify: `packages/create-nextion-app/README.md`
  - Document the new flag and behavior.
- Modify: `packages/create-nextion-app/src/render.test.ts`
  - Add CLI parsing coverage for the new flag because this file already exercises `parseArgs()` and `applyDefaults()`.

### Task 1: Add Skill Install Domain Types And Target Detection

**Files:**
- Create: `packages/create-nextion-app/src/skill-install/types.ts`
- Create: `packages/create-nextion-app/src/skill-install/detect.ts`
- Create: `packages/create-nextion-app/src/skill-install/detect.test.ts`

- [ ] **Step 1: Write the failing detection tests**

```ts
import { describe, expect, it } from "vitest";

import { detectSkillTargets, orderTargets } from "./detect.js";

describe("orderTargets", () => {
  it("returns stable target ordering", () => {
    expect(orderTargets(["codex", "trae", "claude"])).toEqual([
      "trae",
      "claude",
      "codex",
    ]);
  });
});

describe("detectSkillTargets", () => {
  it("returns an empty array when no target markers exist", async () => {
    const targets = await detectSkillTargets({
      pathExists: async () => false,
      commandExists: async () => false,
    });

    expect(targets).toEqual([]);
  });

  it("detects config-directory markers without requiring PATH commands", async () => {
    const targets = await detectSkillTargets({
      pathExists: async (filePath) =>
        filePath.endsWith(".trae") || filePath.endsWith(".codex"),
      commandExists: async () => false,
    });

    expect(targets).toEqual(["trae", "codex"]);
  });

  it("uses executable checks as a secondary signal", async () => {
    const targets = await detectSkillTargets({
      pathExists: async () => false,
      commandExists: async (cmd) => cmd === "claude",
    });

    expect(targets).toEqual(["claude"]);
  });
});
```

- [ ] **Step 2: Run the detection tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/skill-install/detect.test.ts
```

Expected: FAIL with module-not-found errors for `./detect.js`.

- [ ] **Step 3: Add the shared skill-install types**

Create `packages/create-nextion-app/src/skill-install/types.ts`:

```ts
export type SkillInstallMode =
  | "auto"
  | "none"
  | "prompt"
  | "trae"
  | "claude"
  | "codex"
  | "all";

export type SkillInstallTarget = "trae" | "claude" | "codex";

export interface SkillAnswers {
  installSkillMode: SkillInstallMode;
  installSkillTargets: SkillInstallTarget[];
}

export interface ResolvedSkillPlan {
  mode: SkillInstallMode;
  targets: SkillInstallTarget[];
  shouldPrompt: boolean;
}

export interface SkillInstallResult {
  status: "installed" | "skipped" | "not-detected" | "failed";
  targets: SkillInstallTarget[];
  message?: string;
  retryCommand?: string;
}
```

- [ ] **Step 4: Implement conservative target detection**

Create `packages/create-nextion-app/src/skill-install/detect.ts`:

```ts
import { homedir } from "node:os";
import path from "node:path";

import { run } from "../provision/shell.js";
import type { SkillInstallTarget } from "./types.js";

const TARGET_ORDER: SkillInstallTarget[] = ["trae", "claude", "codex"];

export function orderTargets(
  targets: SkillInstallTarget[]
): SkillInstallTarget[] {
  return TARGET_ORDER.filter((target) => targets.includes(target));
}

export async function commandExists(cmd: string): Promise<boolean> {
  try {
    const result = await run(cmd, ["--version"]);
    return result.code === 0;
  } catch {
    return false;
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function detectSkillTargets(deps: {
  pathExists?: (filePath: string) => Promise<boolean>;
  commandExists?: (cmd: string) => Promise<boolean>;
} = {}): Promise<SkillInstallTarget[]> {
  const exists = deps.pathExists ?? pathExists;
  const hasCommand = deps.commandExists ?? commandExists;
  const home = homedir();
  const found = new Set<SkillInstallTarget>();

  if (await exists(path.join(home, ".trae"))) found.add("trae");
  if (await exists(path.join(home, ".claude"))) found.add("claude");
  if (await exists(path.join(home, ".codex"))) found.add("codex");

  if (found.size === 0) {
    if (await hasCommand("trae")) found.add("trae");
    if (await hasCommand("claude")) found.add("claude");
    if (await hasCommand("codex")) found.add("codex");
  }

  return orderTargets([...found]);
}
```

- [ ] **Step 5: Run the detection tests to verify they pass**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/skill-install/detect.test.ts
```

Expected: PASS with 4 passing tests.

- [ ] **Step 6: Commit the detection module**

```bash
git add packages/create-nextion-app/src/skill-install/types.ts \
  packages/create-nextion-app/src/skill-install/detect.ts \
  packages/create-nextion-app/src/skill-install/detect.test.ts
git commit -m "feat: add skill target detection"
```

### Task 2: Extend CLI Parsing And Interactive Prompt Resolution

**Files:**
- Modify: `packages/create-nextion-app/src/answers.ts`
- Modify: `packages/create-nextion-app/src/prompt.ts`
- Modify: `packages/create-nextion-app/src/render.test.ts`
- Test: `packages/create-nextion-app/src/render.test.ts`

- [ ] **Step 1: Add failing parsing tests for `--install-skill`**

Append to `packages/create-nextion-app/src/render.test.ts`:

```ts
describe("skill install answers", () => {
  it("parses explicit skill install targets", () => {
    expect(parseArgs(["node", "cli", "--install-skill=trae"]).installSkill).toBe(
      "trae"
    );
    expect(parseArgs(["node", "cli", "--install-skill", "all"]).installSkill).toBe(
      "all"
    );
  });

  it("defaults non-interactive scaffolds to no skill install", () => {
    const answers = applyDefaults(
      { projectName: "skill-default", yes: true },
      ["node", "cli"]
    );

    expect(answers.installSkillMode).toBe("none");
    expect(answers.installSkillTargets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the parsing tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected: FAIL because `CliOverrides.installSkill` and the returned answer fields do not exist yet.

- [ ] **Step 3: Thread install mode through the answers model**

Update `packages/create-nextion-app/src/prompt.ts` interface section:

```ts
import type {
  SkillAnswers,
  SkillInstallMode,
  SkillInstallTarget,
} from "./skill-install/types.js";

export interface Answers extends SkillAnswers {
  projectName: string;
  targetDir: string;
  defaultLocale: string;
  supportedLocales: string[];
  contentSource: AnswersContentSource;
  uiPreset: UiPreset;
  nextionSource: string;
  adminEmail: string;
  adminPassword: string;
  notionParentPage: string;
  notionSeedCount: number;
}
```

and add defaults:

```ts
export const DEFAULT_ANSWERS: Omit<
  Answers,
  "projectName" | "targetDir"
> = {
  defaultLocale: "en",
  supportedLocales: ["en"],
  nextionSource: "^0.1.2",
  adminEmail: "admin@example.com",
  adminPassword: "ChangeMe1234",
  uiPreset: "site",
  notionParentPage: "",
  notionSeedCount: 3,
  installSkillMode: "none",
  installSkillTargets: [],
  contentSource: {
    id: "blog",
    title: "Blog",
    fields: [
      { key: "title", notionName: "Name" },
    ],
  },
};
```

- [ ] **Step 4: Parse and default the new CLI flag**

Update `packages/create-nextion-app/src/answers.ts`:

```ts
import type { SkillInstallMode, SkillInstallTarget } from "./skill-install/types.js";

interface CliOverrides {
  projectName?: string;
  targetDir?: string;
  defaultLocale?: string;
  supportedLocales?: string;
  contentId?: string;
  contentTitle?: string;
  fields?: string;
  nextionSource?: string;
  uiPreset?: UiPreset;
  adminEmail?: string;
  adminPassword?: string;
  notionParentPage?: string;
  notionSeedCount?: number;
  installSkill?: SkillInstallMode;
  yes?: boolean;
}

function parseInstallSkillMode(value: string): SkillInstallMode {
  if (
    value === "auto" ||
    value === "none" ||
    value === "prompt" ||
    value === "trae" ||
    value === "claude" ||
    value === "codex" ||
    value === "all"
  ) {
    return value;
  }
  throw new Error(
    `Invalid --install-skill: ${value}. Expected auto, none, prompt, trae, claude, codex, or all.`
  );
}

function expandInstallTargets(
  mode: SkillInstallMode
): SkillInstallTarget[] {
  if (mode === "all") return ["trae", "claude", "codex"];
  if (mode === "trae" || mode === "claude" || mode === "codex") return [mode];
  return [];
}
```

and in `parseArgs()`:

```ts
case "--install-skill":
  out.installSkill = parseInstallSkillMode(takeNext(next));
  break;
```

and in `applyDefaults()`:

```ts
const installSkillMode =
  overrides.installSkill ??
  (process.stdin.isTTY && !overrides.yes ? "auto" : "none");

const installSkillTargets = expandInstallTargets(installSkillMode);

return {
  projectName,
  targetDir,
  defaultLocale,
  supportedLocales,
  nextionSource: overrides.nextionSource ?? "^0.1.2",
  uiPreset,
  contentSource: {
    id: contentId,
    title: contentTitle,
    fields,
  },
  adminEmail: adminEmail.toLowerCase(),
  adminPassword,
  notionParentPage,
  notionSeedCount,
  installSkillMode,
  installSkillTargets,
  ...(generatedAdminPassword
    ? { _generatedAdminPassword: generatedAdminPassword }
    : {}),
} as Answers & { _generatedAdminPassword?: string };
```

- [ ] **Step 5: Add the interactive skill prompt hook**

At the end of `packages/create-nextion-app/src/prompt.ts`, after the admin email is collected and before `p.outro(...)`, insert:

```ts
import { detectSkillTargets } from "./skill-install/detect.js";

let installSkillMode: SkillInstallMode = "auto";
let installSkillTargets: SkillInstallTarget[] = [];

const detectedTargets = await detectSkillTargets();
if (detectedTargets.length > 0) {
  const installSkill = await p.confirm({
    message:
      detectedTargets.length === 1
        ? `Detected ${detectedTargets[0]} on this machine. Install the official nextion AI skill for this project?`
        : `Detected AI tools: ${detectedTargets.join(", ")}. Install the official nextion AI skill for this project?`,
    initialValue: true,
  });
  if (p.isCancel(installSkill)) {
    p.cancel("Cancelled by user");
    throw new Error("cancelled");
  }
  if (installSkill) {
    const selectedTargets = await p.multiselect({
      message: "Choose which targets to install into",
      initialValues: detectedTargets,
      options: detectedTargets.map((target) => ({
        value: target,
        label: target,
      })),
      required: false,
    });
    if (p.isCancel(selectedTargets)) {
      p.cancel("Cancelled by user");
      throw new Error("cancelled");
    }
    installSkillTargets = [...selectedTargets] as SkillInstallTarget[];
    installSkillMode =
      installSkillTargets.length === 0
        ? "none"
        : installSkillTargets.length === 3
          ? "all"
          : installSkillTargets[0]!;
  } else {
    installSkillMode = "none";
  }
}
```

Then return the two new fields:

```ts
return {
  projectName: projectName.trim(),
  targetDir,
  defaultLocale: localeConfig.defaultLocale,
  supportedLocales: [...localeConfig.supportedLocales],
  nextionSource: DEFAULT_ANSWERS.nextionSource,
  uiPreset: String(uiPreset) as UiPreset,
  contentSource: {
    id: DEFAULT_ANSWERS.contentSource.id,
    title: DEFAULT_ANSWERS.contentSource.title,
    fields: fields.length ? fields : DEFAULT_ANSWERS.contentSource.fields,
  },
  adminEmail: adminEmail.toLowerCase(),
  adminPassword,
  notionParentPage: DEFAULT_ANSWERS.notionParentPage,
  notionSeedCount: DEFAULT_ANSWERS.notionSeedCount,
  installSkillMode,
  installSkillTargets,
  _generatedAdminPassword: adminPassword,
} as Answers & { _generatedAdminPassword: string };
```

- [ ] **Step 6: Run the answer and prompt regression tests**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts src/skill-install/detect.test.ts
```

Expected: PASS with the new parsing tests and prior UI preset tests still green.

- [ ] **Step 7: Commit the answer-model changes**

```bash
git add packages/create-nextion-app/src/answers.ts \
  packages/create-nextion-app/src/prompt.ts \
  packages/create-nextion-app/src/render.test.ts
git commit -m "feat: add skill install answer flow"
```

### Task 3: Add Installer Resolution And Best-Effort Execution

**Files:**
- Create: `packages/create-nextion-app/src/skill-install/install.ts`
- Create: `packages/create-nextion-app/src/skill-install/install.test.ts`
- Modify: `packages/create-nextion-app/src/index.ts`
- Test: `packages/create-nextion-app/src/skill-install/install.test.ts`

- [ ] **Step 1: Write failing installer-resolution tests**

Create `packages/create-nextion-app/src/skill-install/install.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildRetryCommand,
  buildSkillInstallCommand,
  resolveSkillPlan,
} from "./install.js";

describe("resolveSkillPlan", () => {
  it("skips when mode is none", () => {
    expect(
      resolveSkillPlan({
        installSkillMode: "none",
        installSkillTargets: [],
      })
    ).toEqual({
      mode: "none",
      targets: [],
      shouldPrompt: false,
    });
  });

  it("installs explicit targets without prompting", () => {
    expect(
      resolveSkillPlan({
        installSkillMode: "trae",
        installSkillTargets: ["trae"],
      })
    ).toEqual({
      mode: "trae",
      targets: ["trae"],
      shouldPrompt: false,
    });
  });
});

describe("buildSkillInstallCommand", () => {
  it("builds the published installer command", () => {
    expect(buildSkillInstallCommand("all", "/tmp/demo")).toEqual([
      "npx",
      [
        "@notionx/skill",
        "install",
        "--target",
        "all",
        "--scope",
        "project",
        "--cwd",
        "/tmp/demo",
      ],
    ]);
  });

  it("formats the retry command for logs", () => {
    expect(buildRetryCommand("trae", "/tmp/demo")).toBe(
      "npx @notionx/skill install --target trae --scope project --cwd /tmp/demo"
    );
  });
});
```

- [ ] **Step 2: Run the installer tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/skill-install/install.test.ts
```

Expected: FAIL with missing exports from `./install.js`.

- [ ] **Step 3: Implement plan resolution and installer execution**

Create `packages/create-nextion-app/src/skill-install/install.ts`:

```ts
import type { Answers } from "../prompt.js";
import { run } from "../provision/shell.js";
import type {
  ResolvedSkillPlan,
  SkillInstallMode,
  SkillInstallResult,
} from "./types.js";

export function resolveSkillPlan(
  answers: Pick<Answers, "installSkillMode" | "installSkillTargets">
): ResolvedSkillPlan {
  if (answers.installSkillMode === "none") {
    return { mode: "none", targets: [], shouldPrompt: false };
  }
  return {
    mode: answers.installSkillMode,
    targets: answers.installSkillTargets,
    shouldPrompt: false,
  };
}

export function buildSkillInstallCommand(
  mode: Exclude<SkillInstallMode, "auto" | "none" | "prompt"> | "all",
  projectDir: string
): [string, string[]] {
  return [
    "npx",
    [
      "@notionx/skill",
      "install",
      "--target",
      mode,
      "--scope",
      "project",
      "--cwd",
      projectDir,
    ],
  ];
}

export function buildRetryCommand(
  mode: Exclude<SkillInstallMode, "auto" | "none" | "prompt"> | "all",
  projectDir: string
): string {
  return `npx @notionx/skill install --target ${mode} --scope project --cwd ${projectDir}`;
}

export async function installSkill(
  answers: Pick<Answers, "installSkillMode" | "installSkillTargets">,
  projectDir: string
): Promise<SkillInstallResult> {
  const plan = resolveSkillPlan(answers);
  if (plan.mode === "none" || plan.targets.length === 0) {
    return { status: "skipped", targets: [] };
  }

  const target = plan.mode === "all" ? "all" : plan.targets[0]!;
  const [cmd, args] = buildSkillInstallCommand(target, projectDir);
  const result = await run(cmd, args, { cwd: projectDir });

  if (result.code !== 0) {
    return {
      status: "failed",
      targets: plan.targets,
      message: result.stderr.trim() || result.stdout.trim(),
      retryCommand: buildRetryCommand(target, projectDir),
    };
  }

  return { status: "installed", targets: plan.targets };
}
```

- [ ] **Step 4: Integrate best-effort installation into the create flow**

Update `packages/create-nextion-app/src/index.ts`:

```ts
import { installSkill } from "./skill-install/install.js";

async function main(): Promise<void> {
  try {
    const answers = await gatherAnswers(process.argv);
    const compiled = path.resolve(__dirname, "templates");
    const fromSource = path.resolve(__dirname, "..", "src", "templates");
    const templatesDir = (await existsDir(compiled)) ? compiled : fromSource;

    p.log.info(`Rendering into ${answers.targetDir}…`);
    await render(answers, templatesDir, answers.targetDir);

    const projectDir = path.resolve(process.cwd(), answers.targetDir);

    const skillResult = await installSkill(answers, projectDir);
    if (skillResult.status === "installed") {
      p.log.info(`AI skill: installed for ${skillResult.targets.join(", ")}`);
    } else if (skillResult.status === "failed") {
      p.log.warn(
        `AI skill install failed: ${skillResult.message ?? "unknown error"}`
      );
      if (skillResult.retryCommand) {
        p.log.info(`Retry later with: ${skillResult.retryCommand}`);
      }
    }

    const provisioningEnabled = !process.env.NEXTION_PROVISION_DISABLED;
    if (provisioningEnabled) {
      const interactive = Boolean(process.stdin.isTTY);
      await provision(answers, projectDir, { interactive });
    }
  } catch (err) {
    // existing error handling unchanged
  }
}
```

- [ ] **Step 5: Run installer tests and focused CLI regressions**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- \
  src/skill-install/install.test.ts \
  src/render.test.ts \
  src/skill-install/detect.test.ts
```

Expected: PASS with installer resolution, parsing, and detection tests all green.

- [ ] **Step 6: Commit the installer integration**

```bash
git add packages/create-nextion-app/src/skill-install/install.ts \
  packages/create-nextion-app/src/skill-install/install.test.ts \
  packages/create-nextion-app/src/index.ts
git commit -m "feat: install nextion skill during scaffold"
```

### Task 4: Update Help Text And Package Documentation

**Files:**
- Modify: `packages/create-nextion-app/src/answers.ts`
- Modify: `packages/create-nextion-app/README.md`
- Test: `packages/create-nextion-app/src/render.test.ts`

- [ ] **Step 1: Add a failing documentation assertion**

Append to `packages/create-nextion-app/src/render.test.ts`:

```ts
describe("skill install help text", () => {
  it("documents the install-skill flag in help output", async () => {
    const { execaNode } = await import("execa");
    const result = await execaNode("src/index.ts", ["--help"], {
      cwd: process.cwd(),
      reject: false,
    });

    expect(result.stdout).toContain("--install-skill <mode>");
  });
});
```

- [ ] **Step 2: Run the help-text test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test -- src/render.test.ts
```

Expected: FAIL because `--install-skill` is not present in the help output.

- [ ] **Step 3: Update help output and README examples**

Update the help text in `packages/create-nextion-app/src/answers.ts`:

```ts
  --install-skill <mode>      Install nextion AI skill: auto, none, prompt,
                              trae, claude, codex, or all.
                              Interactive default: auto.
                              --yes / non-interactive default: none.
```

Update `packages/create-nextion-app/README.md` quick-start examples:

```md
### Install skill automatically when a supported tool is detected

```bash
npx @notionx/create-nextion-app my-app
```

In interactive mode, the scaffolder may detect supported AI tools such as
Trae, Claude, or Codex and offer to install the official `nextion` skill into
the generated project.

### Force skill install in non-interactive mode

```bash
npx @notionx/create-nextion-app my-app --yes --install-skill trae
```

### Skip skill install entirely

```bash
npx @notionx/create-nextion-app my-app --install-skill none
```
```

- [ ] **Step 4: Run the package test suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app test
```

Expected: PASS with all create-nextion-app tests green.

- [ ] **Step 5: Commit docs and help text**

```bash
git add packages/create-nextion-app/src/answers.ts \
  packages/create-nextion-app/README.md \
  packages/create-nextion-app/src/render.test.ts
git commit -m "docs: document scaffold skill install options"
```

## Spec Coverage Check

- `--install-skill auto|none|prompt|trae|claude|codex|all`
  - covered by Task 2 parsing/default logic and Task 4 help/README updates
- interactive default `auto`, non-interactive default `none`
  - covered by Task 2 defaults and Task 3 execution
- conservative detection of `trae` / `claude` / `codex`
  - covered by Task 1
- best-effort install after project render
  - covered by Task 3
- project-scope only
  - covered by Task 3 command builder
- failure warning plus retry command
  - covered by Task 3 result handling

No uncovered spec requirements remain for the first implementation slice.

## Self-Review

- Placeholder scan: no `TODO`, `TBD`, or "implement later" markers remain.
- Type consistency: the plan consistently uses `installSkillMode`,
  `installSkillTargets`, `SkillInstallMode`, and `SkillInstallTarget`.
- Scope check: the work stays inside `create-nextion-app` and does not expand to
  `nextion update` or `provision repair`.
