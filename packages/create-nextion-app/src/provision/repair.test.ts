import { describe, expect, it, vi } from "vitest";
import { defaultProvisionMode } from "./options.js";
import type { Answers } from "../prompt.js";
import type { LoadedRegistry } from "../registry/registry-types.js";
import { inspectProvisionRepair, runProvisionRepair } from "./repair.js";

const provisionMock = vi.hoisted(() => vi.fn());
const inspectProvisionMock = vi.hoisted(() => vi.fn());

vi.mock("./index.js", async () => {
  const actual = await vi.importActual<typeof import("./index.js")>("./index.js");
  return {
    ...actual,
    provision: provisionMock,
  };
});

vi.mock("./inspect.js", async () => {
  const actual =
    await vi.importActual<typeof import("./inspect.js")>("./inspect.js");
  return {
    ...actual,
    inspectProvisionRepair: inspectProvisionMock,
  };
});

const registry: LoadedRegistry = {
  manifest: {
    $schema: "https://nextion.dev/schemas/registry.v2.json",
    projectKind: "nextion",
    projectName: "demo",
    scaffoldVersion: "0.4.10",
    nextionCore: "^0.1.2",
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
    compat: { mode: "v2-native" },
    registries: {},
    installed: [],
    managedFiles: { platform: [], bridge: [], user: [] },
  },
  managedFiles: { platform: [], bridge: [], user: [] },
};

const projectDir = "/tmp/demo";

describe("provision mode defaults", () => {
  it("disables deploy for repair mode", () => {
    expect(defaultProvisionMode("repair").deploy).toBe(false);
  });

  it("enables deploy for create mode", () => {
    expect(defaultProvisionMode("create").deploy).toBe(true);
  });
});

describe("runProvisionRepair", () => {
  it("invokes provision in repair mode", async () => {
    const answers: Answers = {
      projectName: "demo",
      targetDir: "./demo",
      defaultLocale: "en",
      supportedLocales: ["en"],
      nextionSource: "^0.1.2",
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
      adminEmail: "admin@example.com",
      adminPassword: "ChangeMe1234",
      notionParentPage: "",
      notionSeedCount: 3,
    };
    provisionMock.mockResolvedValueOnce({ deploy: { skipped: true } });

    await runProvisionRepair(registry, projectDir, answers);

    expect(provisionMock).toHaveBeenCalledWith(
      answers,
      "/tmp/demo",
      expect.objectContaining({
        interactive: false,
        mode: expect.objectContaining({ name: "repair", deploy: false }),
      })
    );
  });

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

    await runProvisionRepair(registry, projectDir, undefined, {
      conflictChoice: "safe-only",
    });

    expect(safeApply).toHaveBeenCalledTimes(1);
    expect(conflictApply).not.toHaveBeenCalled();
  });
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

    const entries = await inspectProvisionRepair(projectDir);

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

    const entries = await inspectProvisionRepair(projectDir);

    expect(entries[0]?.risk).toBe("conflict");
  });
});
