import { beforeEach, describe, expect, it, vi } from "vitest";

const applyUpdateMock = vi.hoisted(() => vi.fn());
const listOfficialItemsMock = vi.hoisted(() => vi.fn());
const resolveStarterTemplatesDirMock = vi.hoisted(() => vi.fn());
const applyCoreUpdateMock = vi.hoisted(() => vi.fn());
const infoMock = vi.hoisted(() => vi.fn());
const errorMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());

// Stub for the diff path (v2).
const loadRegistryMock = vi.hoisted(() => vi.fn());

vi.mock("./registry/update.js", () => ({
  applyUpdate: applyUpdateMock,
}));
vi.mock("./registry/registry-items.js", () => ({
  listOfficialItems: listOfficialItemsMock,
}));
vi.mock("./render.js", () => ({
  resolveStarterTemplatesDir: resolveStarterTemplatesDirMock,
}));
vi.mock("./registry/load-registry.js", () => ({
  loadRegistry: loadRegistryMock,
}));
vi.mock("./registry/core-update.js", () => ({
  applyCoreUpdate: applyCoreUpdateMock,
}));

const runProjectDoctorMock = vi.hoisted(() => vi.fn());
vi.mock("./registry/doctor.js", () => ({
  runProjectDoctor: runProjectDoctorMock,
}));

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  log: { info: infoMock, error: errorMock, warn: warnMock, success: vi.fn() },
}));

// @ts-ignore NodeNext test imports use .js specifiers that resolve to local .ts sources.
import { main } from "./cli-notionx.js";

beforeEach(() => {
  applyUpdateMock.mockReset();
  listOfficialItemsMock.mockReset();
  resolveStarterTemplatesDirMock.mockReset();
  applyCoreUpdateMock.mockReset();
  infoMock.mockReset();
  errorMock.mockReset();
  warnMock.mockReset();
  loadRegistryMock.mockReset();
  runProjectDoctorMock.mockReset();
});

const baseUpdateSummary = {
  plans: {
    additive: [],
    destructive: [],
    noop: [],
    codemodTargets: [],
  },
  wroteFiles: [],
  wroteManifest: false,
  rerenderedFiles: [],
  followup: [],
};

const baseRegistry = {
  manifest: {
    $schema: "https://notionx.dev/schemas/registry.v2.json",
    projectKind: "notionx" as const,
    projectName: "demo",
    scaffoldVersion: "0.6.1",
    notionxCore: "^1.0.0",
    defaultLocale: "en",
    supportedLocales: ["en"],
    enableSiteSettings: true,
    enableBlocks: true,
    enableAuth: true,
    enableAdmin: true,
    enablePages: true,
    enableSearch: true,
    contentSource: {
      id: "blog",
      title: "Blog",
      fields: [{ key: "title", notionName: "Name" }],
    },
    compat: { mode: "v2-native" as const },
    registries: {},
    installed: [
      {
        id: "blog",
        kind: "content-source" as const,
        version: 1,
        source: { kind: "official" as const, name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-15T00:00:00.000Z",
      },
    ],
    managedFiles: {
      platform: ["package.json"],
      bridge: ["worker/index.ts"],
      user: ["app/blog/page.tsx"],
    },
  },
  managedFiles: {
    platform: ["package.json"],
    bridge: ["worker/index.ts"],
    user: ["app/blog/page.tsx"],
  },
};

describe("cli notionx update (v2 path)", () => {
  it("prints the additive / destructive / noop counts", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([{ id: "blog", version: 2 }]);
    applyUpdateMock.mockResolvedValue({
      ...baseUpdateSummary,
      plans: {
        additive: [{ kind: "notion-field-add", itemId: "blog" }],
        destructive: [],
        noop: [],
        codemodTargets: [],
      },
      wroteFiles: ["blog_1_to_2.notion-diff.json", "_meta.json"],
      sequence: "0001",
      followup: ["Apply Notion diff by hand."],
    });

    await main(["update"]);

    expect(infoMock).toHaveBeenCalledWith(
      "Update plan: 1 additive, 0 destructive, 0 already applied.",
    );
    expect(infoMock).toHaveBeenCalledWith("Next migration sequence: 0001");
    expect(infoMock).toHaveBeenCalledWith(
      "  wrote .notionx/migrations/blog_1_to_2.notion-diff.json",
    );
    expect(infoMock).toHaveBeenCalledWith(
      "  wrote .notionx/migrations/_meta.json",
    );
  });

  it("invokes applyUpdate with the official catalog", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([
      { id: "blog", version: 2 },
      { id: "docs", version: 1 },
    ]);
    applyUpdateMock.mockResolvedValue(baseUpdateSummary);

    await main(["update"]);

    expect(applyUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogItems: [
          { id: "blog", version: 2 },
          { id: "docs", version: 1 },
        ],
      }),
    );
  });

  it("forwards --dry-run to applyUpdate", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([{ id: "blog", version: 2 }]);
    applyUpdateMock.mockResolvedValue(baseUpdateSummary);

    await main(["update", "--dry-run"]);

    expect(applyUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
  });

  it("emits a follow-up hint when there are pending migrations", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([{ id: "blog", version: 2 }]);
    applyUpdateMock.mockResolvedValue({
      ...baseUpdateSummary,
      plans: {
        additive: [{ kind: "notion-field-add", itemId: "blog" }],
        destructive: [{ kind: "notion-field-rename", itemId: "blog" }],
        noop: [],
        codemodTargets: [],
      },
      wroteFiles: ["blog_1_to_2.notion-diff.json"],
      followup: ["Apply Notion diff by hand."],
    });

    await main(["update"]);

    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining("notionx migrate --mark-applied <seq>"),
    );
  });

  it("skips the follow-up hint when nothing changed", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([{ id: "blog", version: 2 }]);
    applyUpdateMock.mockResolvedValue(baseUpdateSummary);

    await main(["update"]);

    const allInfoCalls = infoMock.mock.calls.map((c) => c[0]);
    expect(
      allInfoCalls.some((m) => typeof m === "string" && m.includes("notionx migrate")),
    ).toBe(false);
  });
});

describe("cli notionx migrate --mark-applied", () => {
  it("rejects calls that omit the sequence number", async () => {
    await main(["migrate", "--mark-applied"]);
    expect(errorMock).toHaveBeenCalledWith(
      "Usage: notionx migrate --mark-applied <sequence>",
    );
  });
});

describe("cli notionx diff (v2 read-only path)", () => {
  it("prints installed and ownership summary for diff", async () => {
    loadRegistryMock.mockResolvedValue(baseRegistry);

    await main(["diff"]);

    expect(infoMock).toHaveBeenCalledWith("installed:");
    expect(infoMock).toHaveBeenCalledWith("  - blog@1");
    expect(infoMock).toHaveBeenCalledWith("ownership:");
    expect(infoMock).toHaveBeenCalledWith("  - platform: 1");
  });

  it("points users to update --dry-run for diff --upgrade", async () => {
    await main(["diff", "--upgrade"]);

    expect(
      infoMock.mock.calls.some(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("notionx update --dry-run"),
      ),
    ).toBe(true);
  });
});


describe("cli notionx update <item-id> (v2 P0)", () => {
  it("forwards scope={kind:'item',itemId} to applyUpdate", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([{ id: "blog", version: 2 }]);
    applyUpdateMock.mockResolvedValue(baseUpdateSummary);

    await main(["update", "blog"]);

    expect(applyUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "item", itemId: "blog" },
      }),
    );
  });

  it("prints a scoped label in the plan summary", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([{ id: "blog", version: 2 }]);
    applyUpdateMock.mockResolvedValue({
      ...baseUpdateSummary,
      plans: {
        additive: [{ kind: "notion-field-add", itemId: "blog" }],
        destructive: [],
        noop: [],
        codemodTargets: [],
      },
    });

    await main(["update", "blog"]);

    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining('(scoped to "blog")'),
    );
  });

  it("propagates the not-installed error from applyUpdate", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([{ id: "blog", version: 2 }]);
    applyUpdateMock.mockRejectedValue(
      new Error('Cannot update "ghost": not installed.'),
    );

    await main(["update", "ghost"]);

    expect(errorMock).toHaveBeenCalledWith(
      'Cannot update "ghost": not installed.',
    );
  });

  it("update --help prints usage and does not call applyUpdate", async () => {
    await main(["update", "--help"]);
    expect(applyUpdateMock).not.toHaveBeenCalled();
    expect(
      infoMock.mock.calls.some(
        (c) => typeof c[0] === "string" && c[0].includes("Usage: notionx update"),
      ),
    ).toBe(true);
  });
});

describe("cli notionx update --core", () => {
  it("applies a core metadata update and does not call registry item update", async () => {
    applyCoreUpdateMock.mockResolvedValue({
      dryRun: false,
      targetCore: "^3.0.0",
      changes: [
        {
          file: "package.json",
          field: 'dependencies["@notionx/core"]',
          from: "^2.0.0",
          to: "^3.0.0",
        },
      ],
      followup: ["Run `pnpm install` to refresh node_modules and the lockfile."],
    });

    await main(["update", "--core"]);

    expect(applyUpdateMock).not.toHaveBeenCalled();
    expect(applyCoreUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectDir: process.cwd() }),
    );
    expect(infoMock).toHaveBeenCalledWith("Core update: 1 change(s).");
    expect(warnMock).toHaveBeenCalledWith(
      "Run `pnpm install` to refresh node_modules and the lockfile.",
    );
  });

  it("forwards --dry-run and --target to the core updater", async () => {
    applyCoreUpdateMock.mockResolvedValue({
      dryRun: true,
      targetCore: "^3.1.0-next.0",
      changes: [],
      followup: ["Core package metadata is already aligned."],
    });

    await main(["update", "--core", "--dry-run", "--target", "next"]);

    expect(applyCoreUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        target: { kind: "dist-tag", tag: "next" },
      }),
    );
    expect(infoMock).toHaveBeenCalledWith("Core update dry run: 0 change(s).");
  });

  it("forwards --to as an explicit core spec", async () => {
    applyCoreUpdateMock.mockResolvedValue({
      dryRun: false,
      targetCore: "3.0.0",
      changes: [],
      followup: ["Core package metadata is already aligned."],
    });

    await main(["update", "--core", "--to", "3.0.0"]);

    expect(applyCoreUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { kind: "spec", spec: "3.0.0" },
      }),
    );
  });

  it("rejects core target flags without --core", async () => {
    await main(["update", "--target", "latest"]);

    expect(errorMock).toHaveBeenCalledWith(
      "`--target` and `--to` are only supported with `notionx update --core`.",
    );
    expect(applyUpdateMock).not.toHaveBeenCalled();
    expect(applyCoreUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects combining --core with a registry item id", async () => {
    await main(["update", "blog", "--core"]);

    expect(errorMock).toHaveBeenCalledWith(
      "`notionx update --core` cannot be combined with an item id.",
    );
    expect(applyCoreUpdateMock).not.toHaveBeenCalled();
  });
});

describe("cli notionx doctor (v2 P0)", () => {
  it("prints all checks and exits non-zero on error severity", async () => {
    resolveStarterTemplatesDirMock.mockResolvedValue("/tmp/templates/blog");
    listOfficialItemsMock.mockReturnValue([]);
    runProjectDoctorMock.mockResolvedValue({
      projectDir: process.cwd(),
      ok: false,
      checks: [
        { id: "registry.missing", severity: "error", message: "missing" },
        { id: "core.aligned", severity: "ok", message: "core ok" },
      ],
    });

    await main(["doctor"]);

    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("[ERROR] missing"),
    );
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining("doctor: 1 ok, 0 info, 0 warn, 1 error"),
    );
  });
});

describe("cli notionx pull (v2 stub)", () => {
  it("prints a planned-v2.1 message and does not throw", async () => {
    await main(["pull"]);
    expect(
      infoMock.mock.calls.some(
        (c) => typeof c[0] === "string" && c[0].includes("notionx pull is not yet implemented"),
      ),
    ).toBe(true);
    expect(
      infoMock.mock.calls.some(
        (c) =>
          typeof c[0] === "string" && c[0].includes("docs/architecture/registry-protocol.md"),
      ),
    ).toBe(true);
  });
});

describe("cli notionx (no args) prints usage", () => {
  it("prints usage banner and exits 0", async () => {
    await main([]);
    expect(
      infoMock.mock.calls.some(
        (c) => typeof c[0] === "string" && c[0].includes("notionx — v2 registry protocol CLI"),
      ),
    ).toBe(true);
  });
});
