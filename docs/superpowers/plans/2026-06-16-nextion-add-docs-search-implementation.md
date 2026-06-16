# Nextion Add Docs And Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real `nextion add` write path by supporting `nextion add docs` and `nextion add search` in an existing scaffolded blog project.

**Architecture:** Keep the work inside `packages/create-nextion-app`. Add a small install-engine layer that resolves install targets from the template registry, builds an install plan, applies safe file writes and metadata updates, and exposes the result through new CLI `add` subcommands. First-party docs and search installs intentionally stay minimal and docs-scoped.

**Tech Stack:** TypeScript, Vitest, Node.js fs/path APIs, existing `create-nextion-app` CLI, protocol metadata in `.nextion/*`, template registry, ownership-aware update utilities

---

## File Map

- Create: `packages/create-nextion-app/src/add/types.ts`
- Create: `packages/create-nextion-app/src/add/targets.ts`
- Create: `packages/create-nextion-app/src/add/targets.test.ts`
- Create: `packages/create-nextion-app/src/add/files.ts`
- Create: `packages/create-nextion-app/src/add/files.test.ts`
- Create: `packages/create-nextion-app/src/add/install.ts`
- Create: `packages/create-nextion-app/src/add/install.test.ts`
- Create: `packages/create-nextion-app/src/add/format.ts`
- Create: `packages/create-nextion-app/src/add/format.test.ts`
- Modify: `packages/create-nextion-app/src/template-contracts.ts`
- Modify: `packages/create-nextion-app/src/template-registry.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.test.ts`
- Modify: `packages/create-nextion-app/src/diff.ts`
- Modify: `packages/create-nextion-app/src/diff.test.ts`
- Test fixture writes in temp dirs only; do not touch the existing `src/templates/` tree in this phase

## Implementation Notes

- Keep the first install engine in-memory and file-based. Do not introduce migration objects.
- Do not attempt a generic patch engine. Limit patches to JSON metadata files in this phase.
- Model `docs` and `search` as install targets resolved by name.
- Use generated placeholder content for docs/search files. These files only need to prove the write path and route presence.
- Keep `blog` intact. The add flow must not modify `app/page.tsx` or `app/blog/**`.

### Task 1: Extend Template Contracts And Registry For Docs/Search

**Files:**
- Modify: `packages/create-nextion-app/src/template-contracts.ts`
- Modify: `packages/create-nextion-app/src/template-registry.ts`
- Create: `packages/create-nextion-app/src/add/targets.ts`
- Test: `packages/create-nextion-app/src/add/targets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/add/targets.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  getAddTarget,
  listAddTargets,
  resolveInstallRecord,
} from "./targets.js";

describe("add targets", () => {
  it("resolves docs as a site-template target", () => {
    expect(getAddTarget("docs")).toEqual({
      name: "docs",
      kind: "site-template",
      version: 1,
      params: {
        basePath: "/docs",
        contentSourceId: "docs",
      },
    });
  });

  it("resolves search as a feature-module target", () => {
    expect(getAddTarget("search")).toEqual({
      name: "search",
      kind: "feature-module",
      version: 1,
      params: {
        scope: "docs",
      },
    });
  });

  it("lists docs and search as installable targets", () => {
    expect(listAddTargets().map((target) => target.name)).toEqual([
      "docs",
      "search",
    ]);
  });

  it("creates the correct install record for docs", () => {
    expect(resolveInstallRecord("docs")).toEqual({
      name: "docs",
      kind: "site-template",
      version: 1,
      params: {
        basePath: "/docs",
        contentSourceId: "docs",
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/targets.test.ts
```

Expected: FAIL because `src/add/targets.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Add these types to `packages/create-nextion-app/src/template-contracts.ts`:

```ts
export interface AddTargetDefinition {
  name: string;
  kind: TemplateKind;
  version: number;
  params: Record<string, string>;
}
```

Update `packages/create-nextion-app/src/template-registry.ts` so the built-in template list includes docs:

```ts
const docsManagedFiles = {
  platformManaged: [] as string[],
  bridge: ["lib/nextion/content-registry.ts"],
  userOwned: [
    "app/docs/page.tsx",
    "app/docs/[slug]/page.tsx",
    "components/docs/docs-sidebar.tsx",
    "components/docs/docs-page.tsx",
    "lib/content/docs-source.ts",
  ],
};

const builtInTemplates: TemplateDefinition[] = [
  {
    name: DEFAULT_SITE_TEMPLATE,
    kind: "site-template",
    version: 1,
    managedFiles: blogManagedFiles.platformManaged,
    bridgeFiles: blogManagedFiles.bridge,
    userOwnedFiles: blogManagedFiles.userOwned,
  },
  {
    name: "docs",
    kind: "site-template",
    version: 1,
    managedFiles: docsManagedFiles.platformManaged,
    bridgeFiles: docsManagedFiles.bridge,
    userOwnedFiles: docsManagedFiles.userOwned,
  },
];
```

Create `packages/create-nextion-app/src/add/targets.ts`:

```ts
import type { AddTargetDefinition, TemplateInstallationRecord } from "../template-contracts.js";

const addTargets: AddTargetDefinition[] = [
  {
    name: "docs",
    kind: "site-template",
    version: 1,
    params: {
      basePath: "/docs",
      contentSourceId: "docs",
    },
  },
  {
    name: "search",
    kind: "feature-module",
    version: 1,
    params: {
      scope: "docs",
    },
  },
];

export function listAddTargets(): AddTargetDefinition[] {
  return [...addTargets];
}

export function getAddTarget(name: string): AddTargetDefinition | undefined {
  return addTargets.find((target) => target.name === name);
}

export function resolveInstallRecord(name: string): TemplateInstallationRecord {
  const target = getAddTarget(name);
  if (!target) {
    throw new Error(`Unsupported add target: ${name}`);
  }
  return {
    name: target.name,
    kind: target.kind,
    version: target.version,
    params: target.params,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/targets.test.ts
```

Expected: PASS with 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/template-contracts.ts packages/create-nextion-app/src/template-registry.ts packages/create-nextion-app/src/add/targets.ts packages/create-nextion-app/src/add/targets.test.ts
git commit -m "feat(add): register docs and search targets"
```

### Task 2: Add Install File Blueprints

**Files:**
- Create: `packages/create-nextion-app/src/add/files.ts`
- Test: `packages/create-nextion-app/src/add/files.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/add/files.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getInstallFiles } from "./files.js";

describe("install file blueprints", () => {
  it("returns docs file blueprints", () => {
    const files = getInstallFiles("docs");

    expect(files.map((file) => file.filePath)).toEqual([
      "app/docs/page.tsx",
      "app/docs/[slug]/page.tsx",
      "components/docs/docs-sidebar.tsx",
      "components/docs/docs-page.tsx",
      "lib/content/docs-source.ts",
      "lib/nextion/content-registry.ts",
    ]);
    expect(files.find((file) => file.filePath === "app/docs/page.tsx")?.ownership).toBe(
      "userOwned"
    );
    expect(
      files.find((file) => file.filePath === "lib/nextion/content-registry.ts")
        ?.ownership
    ).toBe("bridge");
  });

  it("returns search file blueprints", () => {
    const files = getInstallFiles("search");

    expect(files.map((file) => file.filePath)).toEqual([
      "components/search/search-trigger.tsx",
      "lib/search/docs-search.ts",
      "lib/nextion/site-features.ts",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/files.test.ts
```

Expected: FAIL because `src/add/files.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/create-nextion-app/src/add/files.ts`:

```ts
import type { OwnershipKind } from "../template-contracts.js";

export interface InstallFileBlueprint {
  filePath: string;
  ownership: OwnershipKind;
  content: string;
}

const docsFiles: InstallFileBlueprint[] = [
  {
    filePath: "app/docs/page.tsx",
    ownership: "userOwned",
    content: `export default function DocsIndexPage() {\n  return <main><h1>Docs</h1><p>Docs index installed by Nextion.</p></main>;\n}\n`,
  },
  {
    filePath: "app/docs/[slug]/page.tsx",
    ownership: "userOwned",
    content: `export default function DocsDetailPage() {\n  return <main><h1>Doc page</h1><p>Dynamic docs page installed by Nextion.</p></main>;\n}\n`,
  },
  {
    filePath: "components/docs/docs-sidebar.tsx",
    ownership: "userOwned",
    content: `export function DocsSidebar() {\n  return <aside>Docs sidebar</aside>;\n}\n`,
  },
  {
    filePath: "components/docs/docs-page.tsx",
    ownership: "userOwned",
    content: `export function DocsPageShell(props: { title: string; children?: React.ReactNode }) {\n  return <section><h1>{props.title}</h1>{props.children}</section>;\n}\n`,
  },
  {
    filePath: "lib/content/docs-source.ts",
    ownership: "userOwned",
    content: `export function getDocsEntries() {\n  return [] as Array<{ slug: string; title: string }>;\n}\n`,
  },
  {
    filePath: "lib/nextion/content-registry.ts",
    ownership: "bridge",
    content: `export const contentRegistry = {\n  blog: \"blog\",\n  docs: \"docs\",\n} as const;\n`,
  },
];

const searchFiles: InstallFileBlueprint[] = [
  {
    filePath: "components/search/search-trigger.tsx",
    ownership: "userOwned",
    content: `export function SearchTrigger() {\n  return <button type="button">Search docs</button>;\n}\n`,
  },
  {
    filePath: "lib/search/docs-search.ts",
    ownership: "userOwned",
    content: `export function searchDocs(query: string) {\n  return query.trim();\n}\n`,
  },
  {
    filePath: "lib/nextion/site-features.ts",
    ownership: "bridge",
    content: `export const siteFeatures = {\n  search: {\n    scope: [\"docs\"],\n  },\n} as const;\n`,
  },
];

export function getInstallFiles(targetName: string): InstallFileBlueprint[] {
  if (targetName === "docs") return docsFiles;
  if (targetName === "search") return searchFiles;
  throw new Error(`Unsupported install file target: ${targetName}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/files.test.ts
```

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/add/files.ts packages/create-nextion-app/src/add/files.test.ts
git commit -m "feat(add): add docs and search file blueprints"
```

### Task 3: Build The Install Engine

**Files:**
- Create: `packages/create-nextion-app/src/add/types.ts`
- Create: `packages/create-nextion-app/src/add/install.ts`
- Test: `packages/create-nextion-app/src/add/install.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/add/install.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { INSTALLATIONS_FILE, MANAGED_FILES_FILE } from "../template-contracts.js";
import { installTarget } from "./install.js";

describe("installTarget", () => {
  it("installs docs into an existing project", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "nextion-add-docs-"));
    await mkdir(path.join(root, ".nextion"), { recursive: true });
    await writeFile(
      path.join(root, ".nextion", "scaffold.json"),
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
      path.join(root, INSTALLATIONS_FILE),
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
      path.join(root, MANAGED_FILES_FILE),
      JSON.stringify({
        platformManaged: ["package.json"],
        bridge: ["worker/index.ts"],
        userOwned: ["app/blog/page.tsx"],
      })
    );

    const summary = await installTarget(root, "docs");

    expect(summary.applied).toContain("app/docs/page.tsx");
    expect(summary.applied).toContain("lib/nextion/content-registry.ts");

    const installations = JSON.parse(
      await readFile(path.join(root, INSTALLATIONS_FILE), "utf8")
    ) as { templates: Array<{ name: string }>; modules: Array<{ name: string }> };

    expect(installations.templates.map((entry) => entry.name)).toEqual([
      "blog",
      "docs",
    ]);
  });

  it("installs search as a module after docs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "nextion-add-search-"));
    await mkdir(path.join(root, ".nextion"), { recursive: true });
    await writeFile(
      path.join(root, ".nextion", "scaffold.json"),
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
      path.join(root, INSTALLATIONS_FILE),
      JSON.stringify({
        templates: [
          {
            name: "blog",
            kind: "site-template",
            version: 1,
            params: { contentSourceId: "blog" },
          },
          {
            name: "docs",
            kind: "site-template",
            version: 1,
            params: { basePath: "/docs", contentSourceId: "docs" },
          },
        ],
        modules: [],
      })
    );
    await writeFile(
      path.join(root, MANAGED_FILES_FILE),
      JSON.stringify({
        platformManaged: ["package.json"],
        bridge: ["worker/index.ts", "lib/nextion/content-registry.ts"],
        userOwned: [
          "app/blog/page.tsx",
          "app/docs/page.tsx",
          "app/docs/[slug]/page.tsx",
          "components/docs/docs-sidebar.tsx",
          "components/docs/docs-page.tsx",
          "lib/content/docs-source.ts",
        ],
      })
    );

    const summary = await installTarget(root, "search");

    expect(summary.applied).toContain("components/search/search-trigger.tsx");
    expect(summary.applied).toContain("lib/nextion/site-features.ts");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/install.test.ts
```

Expected: FAIL because `src/add/install.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/create-nextion-app/src/add/types.ts`:

```ts
import type { OwnershipKind, TemplateInstallationRecord } from "../template-contracts.js";

export interface InstallPlanEntry {
  filePath: string;
  ownership: OwnershipKind;
  content: string;
}

export interface InstallSummary {
  applied: string[];
  review: string[];
  conflicts: string[];
  metadataUpdated: string[];
  postActions: string[];
}

export interface InstallMetadataUpdate {
  record: TemplateInstallationRecord;
  targetFile: "installations" | "managed-files";
}
```

Create `packages/create-nextion-app/src/add/install.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getInstallFiles } from "./files.js";
import { resolveInstallRecord } from "./targets.js";
import { loadProjectContext } from "../project-context.js";
import {
  INSTALLATIONS_FILE,
  MANAGED_FILES_FILE,
  type InstallationManifest,
  type ManagedFilesManifest,
} from "../template-contracts.js";
import type { InstallSummary } from "./types.js";

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function mergeManagedFiles(
  current: ManagedFilesManifest,
  targetName: string
): ManagedFilesManifest {
  const files = getInstallFiles(targetName);
  const next = {
    platformManaged: [...current.platformManaged],
    bridge: [...current.bridge],
    userOwned: [...current.userOwned],
  };

  for (const file of files) {
    const bucket =
      file.ownership === "platformManaged"
        ? next.platformManaged
        : file.ownership === "bridge"
          ? next.bridge
          : next.userOwned;
    if (!bucket.includes(file.filePath)) {
      bucket.push(file.filePath);
    }
  }

  next.platformManaged.sort();
  next.bridge.sort();
  next.userOwned.sort();
  return next;
}

export async function installTarget(
  projectDir: string,
  targetName: string
): Promise<InstallSummary> {
  const context = await loadProjectContext(projectDir);
  const record = resolveInstallRecord(targetName);
  const files = getInstallFiles(targetName);
  const applied: string[] = [];
  const conflicts: string[] = [];

  for (const file of files) {
    const absolutePath = path.join(projectDir, file.filePath);
    const existing = await readFile(absolutePath, "utf8").catch(() => null);
    if (existing !== null && file.ownership === "userOwned") {
      conflicts.push(file.filePath);
      continue;
    }
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, "utf8");
    applied.push(file.filePath);
  }

  const installations: InstallationManifest = {
    templates: [...context.installations.templates],
    modules: [...context.installations.modules],
  };

  if (record.kind === "site-template") {
    if (!installations.templates.some((entry) => entry.name === record.name)) {
      installations.templates.push(record);
    }
  } else {
    if (!installations.modules.some((entry) => entry.name === record.name)) {
      installations.modules.push(record);
    }
  }

  const managedFiles = mergeManagedFiles(context.managedFiles, targetName);

  await writeJson(path.join(projectDir, INSTALLATIONS_FILE), installations);
  await writeJson(path.join(projectDir, MANAGED_FILES_FILE), managedFiles);

  return {
    applied,
    review: [],
    conflicts,
    metadataUpdated: [INSTALLATIONS_FILE, MANAGED_FILES_FILE],
    postActions: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/install.test.ts
```

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/add/types.ts packages/create-nextion-app/src/add/install.ts packages/create-nextion-app/src/add/install.test.ts
git commit -m "feat(add): add minimal install engine"
```

### Task 4: Format Add Summaries

**Files:**
- Create: `packages/create-nextion-app/src/add/format.ts`
- Test: `packages/create-nextion-app/src/add/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/add/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatInstallSummary } from "./format.js";

describe("formatInstallSummary", () => {
  it("prints applied files, metadata updates, and conflicts", () => {
    expect(
      formatInstallSummary({
        applied: ["app/docs/page.tsx", "lib/nextion/content-registry.ts"],
        review: ["components/site/site-header.tsx"],
        conflicts: ["components/docs/docs-page.tsx"],
        metadataUpdated: [
          ".nextion/installations.json",
          ".nextion/managed-files.json",
        ],
        postActions: ["run `pnpm install`"],
      })
    ).toEqual([
      "applied:",
      "  - app/docs/page.tsx",
      "  - lib/nextion/content-registry.ts",
      "review:",
      "  - components/site/site-header.tsx",
      "conflicts:",
      "  - components/docs/docs-page.tsx",
      "metadata:",
      "  - .nextion/installations.json",
      "  - .nextion/managed-files.json",
      "follow-up:",
      "  - run `pnpm install`",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/format.test.ts
```

Expected: FAIL because `src/add/format.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/create-nextion-app/src/add/format.ts`:

```ts
import type { InstallSummary } from "./types.js";

export function formatInstallSummary(summary: InstallSummary): string[] {
  const lines: string[] = [];

  if (summary.applied.length > 0) {
    lines.push("applied:");
    for (const item of summary.applied) lines.push(`  - ${item}`);
  }
  if (summary.review.length > 0) {
    lines.push("review:");
    for (const item of summary.review) lines.push(`  - ${item}`);
  }
  if (summary.conflicts.length > 0) {
    lines.push("conflicts:");
    for (const item of summary.conflicts) lines.push(`  - ${item}`);
  }
  if (summary.metadataUpdated.length > 0) {
    lines.push("metadata:");
    for (const item of summary.metadataUpdated) lines.push(`  - ${item}`);
  }
  if (summary.postActions.length > 0) {
    lines.push("follow-up:");
    for (const item of summary.postActions) lines.push(`  - ${item}`);
  }

  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/format.test.ts
```

Expected: PASS with 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/add/format.ts packages/create-nextion-app/src/add/format.test.ts
git commit -m "feat(add): format install summaries"
```

### Task 5: Wire CLI `add docs` And `add search`

**Files:**
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.test.ts`
- Modify: `packages/create-nextion-app/src/diff.ts`
- Modify: `packages/create-nextion-app/src/diff.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests to `packages/create-nextion-app/src/cli-nextion.test.ts`:

```ts
const installTargetMock = vi.hoisted(() => vi.fn());
```

Add this mock:

```ts
vi.mock("./add/install.js", () => ({
  installTarget: installTargetMock,
}));
```

Append these tests:

```ts
  it("runs add docs and prints install summary", async () => {
    installTargetMock.mockResolvedValue({
      applied: ["app/docs/page.tsx"],
      review: [],
      conflicts: [],
      metadataUpdated: [".nextion/installations.json"],
      postActions: [],
    });

    await main(["add", "docs"]);

    expect(installTargetMock).toHaveBeenCalledWith(process.cwd(), "docs");
    expect(infoMock).toHaveBeenCalledWith("applied:");
    expect(infoMock).toHaveBeenCalledWith("  - app/docs/page.tsx");
  });

  it("runs add search and prints install summary", async () => {
    installTargetMock.mockResolvedValue({
      applied: ["components/search/search-trigger.tsx"],
      review: [],
      conflicts: [],
      metadataUpdated: [".nextion/managed-files.json"],
      postActions: [],
    });

    await main(["add", "search"]);

    expect(installTargetMock).toHaveBeenCalledWith(process.cwd(), "search");
    expect(infoMock).toHaveBeenCalledWith("  - components/search/search-trigger.tsx");
  });
```

Append this test to `packages/create-nextion-app/src/diff.test.ts`:

```ts
  it("includes modules in diff summary", () => {
    const summary = buildDiffSummary({
      installations: {
        templates: [
          {
            name: "blog",
            kind: "site-template",
            version: 1,
            params: { contentSourceId: "blog" },
          },
          {
            name: "docs",
            kind: "site-template",
            version: 1,
            params: { basePath: "/docs", contentSourceId: "docs" },
          },
        ],
        modules: [
          {
            name: "search",
            kind: "feature-module",
            version: 1,
            params: { scope: "docs" },
          },
        ],
      },
      managedFiles: {
        platformManaged: ["package.json"],
        bridge: ["worker/index.ts", "lib/nextion/site-features.ts"],
        userOwned: ["app/blog/page.tsx", "app/docs/page.tsx"],
      },
    });

    expect(summary.templates).toEqual(["blog@1", "docs@1"]);
    expect(summary.modules).toEqual(["search@1"]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/cli-nextion.test.ts src/diff.test.ts
```

Expected: FAIL because `add` is not wired and diff summary does not include modules.

- [ ] **Step 3: Write minimal implementation**

Update `packages/create-nextion-app/src/diff.ts`:

```ts
export interface DiffSummary {
  templates: string[];
  modules: string[];
  ownership: {
    platformManaged: number;
    bridge: number;
    userOwned: number;
  };
}
```

Update `buildDiffSummary()`:

```ts
    modules: input.installations.modules.map(
      (module) => `${module.name}@${module.version}`
    ),
```

Update `formatDiffSummary()`:

```ts
    "modules:",
    ...summary.modules.map((module) => `  - ${module}`),
```

Update `packages/create-nextion-app/src/cli-nextion.ts` imports:

```ts
import { formatInstallSummary } from "./add/format.js";
import { installTarget } from "./add/install.js";
```

Add this branch before `diff`:

```ts
  if (command === "add" && subcommand) {
    const summary = await installTarget(process.cwd(), subcommand);
    for (const line of formatInstallSummary(summary)) {
      p.log.info(line);
    }
    return;
  }
```

Create the shared formatter import in `packages/create-nextion-app/src/cli-nextion.test.ts` by mocking the real install summary output through CLI logging only; keep the rest of the mocks unchanged.

- [ ] **Step 4: Run the package-level targeted suite**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/format.test.ts src/add/install.test.ts src/cli-nextion.test.ts src/diff.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/cli-nextion.ts packages/create-nextion-app/src/cli-nextion.test.ts packages/create-nextion-app/src/diff.ts packages/create-nextion-app/src/diff.test.ts
git commit -m "feat(cli): add docs and search install commands"
```

### Task 6: Final Verification

**Files:**
- Modify: none

- [ ] **Step 1: Run focused add-flow regressions**

Run:

```bash
pnpm --filter @notionx/create-nextion-app exec vitest run src/add/targets.test.ts src/add/files.test.ts src/add/install.test.ts src/add/format.test.ts src/cli-nextion.test.ts src/diff.test.ts
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

Expected: only planned files plus any pre-existing unrelated user changes.

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/add/types.ts packages/create-nextion-app/src/add/targets.ts packages/create-nextion-app/src/add/targets.test.ts packages/create-nextion-app/src/add/files.ts packages/create-nextion-app/src/add/files.test.ts packages/create-nextion-app/src/add/install.ts packages/create-nextion-app/src/add/install.test.ts packages/create-nextion-app/src/add/format.ts packages/create-nextion-app/src/add/format.test.ts packages/create-nextion-app/src/cli-nextion.ts packages/create-nextion-app/src/cli-nextion.test.ts packages/create-nextion-app/src/diff.ts packages/create-nextion-app/src/diff.test.ts packages/create-nextion-app/src/template-contracts.ts packages/create-nextion-app/src/template-registry.ts
git commit -m "chore(add): verify docs and search install flow"
```

## Self-Review

### Spec Coverage

- `nextion add docs`: covered by add target registration, file blueprints, install engine, and CLI wiring.
- `nextion add search`: covered by the same install path with module-specific records and files.
- Coexistence with blog: covered by install tests that start from blog metadata and append docs/search records.
- Metadata updates: covered by `installations.json` and `managed-files.json` merge behavior in the install engine.
- Ownership-respecting write path: covered by the install engine conflict rule for pre-existing user-owned files.
- `diff` visibility for installed capabilities: covered by extending diff summary to include modules.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” markers remain.
- Every code-writing step includes concrete code blocks.
- Every test step includes exact commands and expected outcomes.

### Type Consistency

- `AddTargetDefinition`, `TemplateInstallationRecord`, and `DiffSummary` use consistent `name/kind/version/params` shapes.
- Install summaries always use `applied/review/conflicts/metadataUpdated/postActions`.
- The CLI add path consumes the same install summary formatter defined in the add subsystem.
