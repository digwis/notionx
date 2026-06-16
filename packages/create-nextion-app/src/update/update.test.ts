import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-ignore NodeNext test imports use .js specifiers that resolve to local .ts sources.
import { isScaffoldManagedFile, scaffoldManagedFiles } from "./scaffold-files.js";
import { vi } from "vitest";
// @ts-ignore NodeNext test imports use .js specifiers that resolve to local .ts sources.
import {
  buildUnifiedUpdatePlan,
  formatUnifiedUpdateSummary,
  runUnifiedUpdate,
  runUpdate,
} from "./index.js";
import type { ProjectContext } from "../project-context.js";
// @ts-ignore NodeNext test imports use .js specifiers that resolve to local .ts sources.
import { formatUpdateSummary } from "../cli-nextion.js";
// @ts-ignore NodeNext test imports use .js specifiers that resolve to local .ts sources.
import { buildUpdateAnswers } from "./update-answers.js";
// @ts-ignore NodeNext test imports use .js specifiers that resolve to local .ts sources.
import { resolveTemplatesDir } from "../render.js";

const buildUpdatePlanMock = vi.hoisted(() => vi.fn());

const unifiedContext: ProjectContext = {
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
  installations: { templates: [], modules: [] },
  managedFiles: { platformManaged: [], bridge: [], userOwned: [] },
};

vi.mock("./template-sync.js", async () => {
  const actual =
    await vi.importActual<typeof import("./template-sync.js")>(
      "./template-sync.js"
    );
  return {
    ...actual,
    buildUpdatePlan: buildUpdatePlanMock,
  };
});

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

describe("runUpdate", () => {
  it("writes updated scaffold-owned files and leaves others untouched", async () => {
    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "nextion-run-update-")
    );
    await mkdir(path.join(projectDir, ".nextion"), { recursive: true });
    await writeFile(
      path.join(projectDir, "package.json"),
      '{"name":"old"}\n',
      "utf8"
    );
    await writeFile(path.join(projectDir, "custom.txt"), "keep me\n", "utf8");

    const context: ProjectContext = {
      projectDir,
      metadata: {
        projectKind: "nextion",
        projectName: "demo",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en"],
        nextionSource: "^0.1.2",
        enableSiteSettings: true,
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
      installations: { templates: [], modules: [] },
      managedFiles: { platformManaged: [], bridge: [], userOwned: [] },
    };
    buildUpdatePlanMock.mockResolvedValueOnce([
      {
        filePath: "package.json",
        status: "updated",
        nextContent: '{"name":"new"}\n',
      },
      {
        filePath: "README.md",
        status: "missing",
        nextContent: "# Demo\n",
      },
      {
        filePath: "wrangler.jsonc",
        status: "unchanged",
        nextContent: "{}\n",
      },
      {
        filePath: ".dev.vars.example",
        status: "skipped",
      },
    ]);

    const summary = await runUpdate(context);
    const updatedPackageJson = await readFile(
      path.join(projectDir, "package.json"),
      "utf8"
    );
    const custom = await readFile(path.join(projectDir, "custom.txt"), "utf8");

    expect(
      summary.updated.some(
        (entry: { filePath: string }) => entry.filePath === "package.json"
      )
    ).toBe(true);
    expect(
      summary.missing.some(
        (entry: { filePath: string }) => entry.filePath === "README.md"
      )
    ).toBe(true);
    expect(summary.needsInstall).toBe(true);
    expect(custom).toBe("keep me\n");
    expect(updatedPackageJson).toBe('{"name":"new"}\n');
  });
});

describe("buildUnifiedUpdatePlan", () => {
  it("classifies missing scaffold-managed files as safe entries", async () => {
    const plan = await buildUnifiedUpdatePlan({
      context: unifiedContext,
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
      context: unifiedContext,
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
    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "nextion-run-unified-update-")
    );
    const context: ProjectContext = {
      ...unifiedContext,
      projectDir,
    };

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
        nextionSource: "^0.1.2",
        enableSiteSettings: true,
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
      installations: { templates: [], modules: [] },
      managedFiles: { platformManaged: [], bridge: [], userOwned: [] },
    });

    expect(answers.projectName).toBe("demo");
    expect(answers.targetDir).toBe("/tmp/demo");
    expect(answers.supportedLocales).toEqual(["en", "zh-CN"]);
    expect(answers.contentSource.fields).toEqual([
      { key: "title", notionName: "Name" },
    ]);
  });

  it("preserves workspace:* for legacy-vinext compatibility projects", () => {
    const answers = buildUpdateAnswers({
      projectDir: "/tmp/legacy",
      metadata: {
        projectKind: "nextion",
        projectName: "moviebluebook",
        scaffoldVersion: "pre-0.5.4",
        defaultLocale: "en",
        supportedLocales: ["en", "zh"],
        // Some legacy projects never set the marker — they only
        // have `workspace:*`. We should still lock them.
        nextionSource: "workspace:*",
        enableSiteSettings: true,
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
        compatibility: "legacy-vinext",
      },
      installations: { templates: [], modules: [] },
      managedFiles: { platformManaged: [], bridge: [], userOwned: [] },
    });

    expect(answers.nextionSource).toBe("workspace:*");
  });

  it("preserves workspace:* even when the marker is absent (existing monorepo users)", () => {
    const answers = buildUpdateAnswers({
      projectDir: "/tmp/legacy-no-marker",
      metadata: {
        projectKind: "nextion",
        projectName: "moviebluebook",
        scaffoldVersion: "0.5.3",
        defaultLocale: "en",
        supportedLocales: ["en"],
        nextionSource: "workspace:*",
        enableSiteSettings: true,
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
      installations: { templates: [], modules: [] },
      managedFiles: { platformManaged: [], bridge: [], userOwned: [] },
    });

    expect(answers.nextionSource).toBe("workspace:*");
  });

  it("leaves normal semver-based projects alone", () => {
    const answers = buildUpdateAnswers({
      projectDir: "/tmp/consumer",
      metadata: {
        projectKind: "nextion",
        projectName: "consumer",
        scaffoldVersion: "0.5.4",
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
      installations: { templates: [], modules: [] },
      managedFiles: { platformManaged: [], bridge: [], userOwned: [] },
    });

    expect(answers.nextionSource).toBe("^1.0.0");
  });
});

describe("resolveTemplatesDir", () => {
  it("resolves a usable templates directory", async () => {
    const templatesDir = await resolveTemplatesDir();
    expect(templatesDir.endsWith("templates")).toBe(true);
  });
});

describe("formatUpdateSummary", () => {
  it("includes grouped statuses and install hint", () => {
    const output = formatUpdateSummary({
      updated: [{ filePath: "package.json", status: "updated", nextContent: "{}" }],
      missing: [{ filePath: "README.md", status: "missing", nextContent: "# Demo" }],
      unchanged: [{ filePath: "wrangler.jsonc", status: "unchanged", nextContent: "{}" }],
      skipped: [{ filePath: ".dev.vars.example", status: "skipped" }],
      needsInstall: true,
    });

    expect(output).toContain("updated:");
    expect(output).toContain("  - package.json");
    expect(output).toContain("  - run `pnpm install`");
  });

  it("announces preserved legacy compatibility", () => {
    const output = formatUpdateSummary({
      updated: [],
      missing: [],
      unchanged: [],
      skipped: [],
      needsInstall: false,
      compatibilityPreserved: true,
    });

    expect(output).toContain("compatibility:");
    expect(output.join("\n")).toContain("`nextionSource` left as `workspace:*`");
    expect(output).not.toContain("run `pnpm install`");
  });

  it("runUpdate surfaces compatibility preservation through the formatter (legacy-vinext end-to-end)", async () => {
    // End-to-end: buildUpdatePlan returns no diffs (everything unchanged),
    // but the metadata carries compatibility: "legacy-vinext", so the
    // summary the user sees must still call out the preserved symlink.
    buildUpdatePlanMock.mockResolvedValueOnce([]);

    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "nextion-update-legacy-")
    );
    const summary = await runUpdate({
      projectDir,
      metadata: {
        projectKind: "nextion",
        projectName: "moviebluebook",
        scaffoldVersion: "pre-0.5.4",
        defaultLocale: "en",
        supportedLocales: ["en", "zh"],
        nextionSource: "workspace:*",
        enableSiteSettings: true,
        compatibility: "legacy-vinext",
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
      installations: { templates: [], modules: [] },
      managedFiles: { platformManaged: [], bridge: [], userOwned: [] },
    });

    expect(summary.compatibilityPreserved).toBe(true);
    const lines = formatUpdateSummary(summary);
    expect(lines).toContain("compatibility:");
    expect(lines.join("\n")).toContain("`nextionSource` left as `workspace:*`");
  });

  it("omits compatibility line when not preserved", () => {
    const output = formatUpdateSummary({
      updated: [],
      missing: [],
      unchanged: [],
      skipped: [],
      needsInstall: false,
      compatibilityPreserved: false,
    });

    expect(output.join("\n")).not.toMatch(/^compatibility:/m);
  });
});

describe("formatUnifiedUpdateSummary", () => {
  it("prints safe, conflict, and follow-up groups", () => {
    const lines = formatUnifiedUpdateSummary({
      appliedSafe: [
        {
          label: "file:README.md",
          kind: "file",
          risk: "safe",
          group: "codeTemplate",
          apply: async () => undefined,
        },
      ],
      appliedConflicts: [],
      reviewRemaining: [],
      conflictsRemaining: [
        {
          label: "file:wrangler.jsonc",
          kind: "file",
          risk: "conflict",
          group: "codeTemplate",
          apply: async () => undefined,
        },
      ],
      needsInstall: true,
      compatibilityPreserved: true,
    });

    expect(lines).toContain("safe updates:");
    expect(lines).toContain("conflicts remaining:");
    expect(lines).toContain("  - run `pnpm install`");
  });
});

describe("buildUpdatePlan", () => {
  it("marks changed and missing scaffold-owned files from temp scaffold output", async () => {
    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "nextion-update-project-")
    );
    await mkdir(path.join(projectDir, ".nextion"), { recursive: true });
    await writeFile(
      path.join(projectDir, "package.json"),
      '{"name":"old"}\n',
      "utf8"
    );
    await writeFile(
      path.join(projectDir, ".nextion", "scaffold.json"),
      JSON.stringify(
        {
          projectKind: "nextion",
          projectName: "demo",
          scaffoldVersion: "0.4.10",
          defaultLocale: "en",
          supportedLocales: ["en"],
          nextionSource: "^0.1.2",
          enableSiteSettings: true,
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

    const { buildUpdatePlan: actualBuildUpdatePlan } =
      await vi.importActual<typeof import("./template-sync.js")>(
        "./template-sync.js"
      );
    const plan = await actualBuildUpdatePlan({
      projectDir,
      metadata: {
        projectKind: "nextion",
        projectName: "demo",
        scaffoldVersion: "0.4.10",
        defaultLocale: "en",
        supportedLocales: ["en"],
        nextionSource: "^0.1.2",
        enableSiteSettings: true,
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Name" }],
        },
      },
      installations: { templates: [], modules: [] },
      managedFiles: { platformManaged: [], bridge: [], userOwned: [] },
    });

    expect(
      plan.some(
        (entry) =>
          entry.filePath === "README.md" && entry.status === "missing"
      )
    ).toBe(true);
  });

  it("documents update as the only public upgrade command", async () => {
    const upgradingDoc = await readFile(
      new URL("../../../../docs/architecture/upgrading-nextion.md", import.meta.url),
      "utf8"
    );

    expect(upgradingDoc).toContain("nextion update");
    expect(upgradingDoc).not.toContain("nextion provision repair");
  });
});
