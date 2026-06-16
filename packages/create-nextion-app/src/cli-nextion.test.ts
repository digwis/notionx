import { describe, expect, it, vi } from "vitest";

const loadProjectContextMock = vi.hoisted(() => vi.fn());
const buildTemplatePlanMock = vi.hoisted(() => vi.fn());
const inspectProvisionRepairMock = vi.hoisted(() => vi.fn());
const runUnifiedUpdateMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const infoMock = vi.hoisted(() => vi.fn());

const context = {
  projectDir: "/tmp/demo",
  metadata: {
    projectKind: "nextion" as const,
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
  formatUnifiedUpdateSummary: (summary: {
    appliedSafe: Array<{ label: string }>;
    appliedConflicts: Array<{ label: string }>;
    reviewRemaining: Array<{ label: string }>;
    conflictsRemaining: Array<{ label: string }>;
  }) => {
    const lines: string[] = [];
    if (summary.appliedSafe.length > 0) {
      lines.push("safe updates:");
      for (const entry of summary.appliedSafe) {
        lines.push(`  - ${entry.label}`);
      }
    }
    if (summary.reviewRemaining.length > 0) {
      lines.push("review items:");
      for (const entry of summary.reviewRemaining) {
        lines.push(`  - ${entry.label}`);
      }
    }
    if (summary.appliedConflicts.length > 0) {
      lines.push("conflict updates:");
      for (const entry of summary.appliedConflicts) {
        lines.push(`  - ${entry.label}`);
      }
    }
    if (summary.conflictsRemaining.length > 0) {
      lines.push("conflicts remaining:");
      for (const entry of summary.conflictsRemaining) {
        lines.push(`  - ${entry.label}`);
      }
    }
    return lines;
  },
}));

vi.mock("@clack/prompts", () => ({
  select: selectMock,
  log: { info: infoMock, error: vi.fn() },
}));

// @ts-ignore NodeNext test imports use .js specifiers that resolve to local .ts sources.
import { main } from "./cli-nextion.js";

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
      reviewRemaining: [],
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
    loadProjectContextMock.mockResolvedValue(context);

    await expect(main(["provision", "repair"])).rejects.toThrow(
      "Unsupported command: provision repair"
    );
  });

  it("prints cloudflare secret repair labels in unified update summary", async () => {
    loadProjectContextMock.mockResolvedValue(context);
    buildTemplatePlanMock.mockResolvedValue([]);
    inspectProvisionRepairMock.mockResolvedValue([
      {
        label: "cloudflare-secret:NOTION_DATA_SOURCE_ID",
        kind: "cloudflare",
        group: "cloudflareBinding",
        risk: "safe",
        apply: vi.fn(),
      },
    ]);
    runUnifiedUpdateMock.mockResolvedValue({
      appliedSafe: [
        {
          label: "cloudflare-secret:NOTION_DATA_SOURCE_ID",
          kind: "cloudflare",
          group: "cloudflareBinding",
          risk: "safe",
          apply: vi.fn(),
        },
      ],
      appliedConflicts: [],
      reviewRemaining: [],
      conflictsRemaining: [],
      needsInstall: false,
      compatibilityPreserved: false,
    });

    await main(["update"]);

    expect(infoMock).toHaveBeenCalledWith("safe updates:");
    expect(infoMock).toHaveBeenCalledWith(
      "  - cloudflare-secret:NOTION_DATA_SOURCE_ID"
    );
  });

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
});
