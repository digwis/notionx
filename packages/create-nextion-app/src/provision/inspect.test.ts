import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectContext } from "../project-context.js";

const readFileMock = vi.hoisted(() => vi.fn());
const runMock = vi.hoisted(() => vi.fn());
const setWorkerSecretMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
}));

vi.mock("./shell.js", async () => {
  const actual = await vi.importActual<typeof import("./shell.js")>("./shell.js");
  return {
    ...actual,
    run: runMock,
  };
});

vi.mock("./cloudflare.js", async () => {
  const actual =
    await vi.importActual<typeof import("./cloudflare.js")>("./cloudflare.js");
  return {
    ...actual,
    setWorkerSecret: setWorkerSecretMock,
  };
});

import { inspectProvisionRepair } from "./inspect.js";

const context: ProjectContext = {
  projectDir: "/tmp/demo",
  metadata: {
    projectKind: "nextion",
    projectName: "demo",
    scaffoldVersion: "0.7.0",
    defaultLocale: "en",
    supportedLocales: ["en"],
    nextionSource: "^1.1.0",
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

describe("inspectProvisionRepair", () => {
  beforeEach(() => {
    readFileMock.mockReset();
    runMock.mockReset();
    setWorkerSecretMock.mockReset();
  });

  it("emits safe cloudflare repair entries for missing notion worker secrets", async () => {
    readFileMock.mockResolvedValue(
      [
        "NOTION_TOKEN=secret-token",
        "NOTION_DATA_SOURCE_ID=content-ds",
        "NOTION_PAGES_DATA_SOURCE_ID=pages-ds",
      ].join("\n")
    );
    runMock.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify([{ name: "NOTION_TOKEN" }]),
      stderr: "",
    });

    const entries = await inspectProvisionRepair(context);

    expect(entries.map((entry) => entry.label)).toEqual([
      "cloudflare-secret:NOTION_DATA_SOURCE_ID",
      "cloudflare-secret:NOTION_PAGES_DATA_SOURCE_ID",
    ]);
    expect(entries.every((entry) => entry.risk === "safe")).toBe(true);
    expect(entries.every((entry) => entry.group === "cloudflareBinding")).toBe(true);
  });

  it("skips notion secret repair when local ids are absent", async () => {
    readFileMock.mockResolvedValue("NOTION_TOKEN=secret-token\n");
    runMock.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify([{ name: "NOTION_TOKEN" }]),
      stderr: "",
    });

    const entries = await inspectProvisionRepair(context);

    expect(entries).toEqual([]);
  });

  it("applies missing notion secret entries through the worker secret helper", async () => {
    readFileMock.mockResolvedValue(
      [
        "NOTION_TOKEN=secret-token",
        "NOTION_DATA_SOURCE_ID=content-ds",
        "NOTION_PAGES_DATA_SOURCE_ID=pages-ds",
      ].join("\n")
    );
    runMock.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify([{ name: "NOTION_TOKEN" }]),
      stderr: "",
    });

    const entries = await inspectProvisionRepair(context);

    await entries[0]?.apply();

    expect(setWorkerSecretMock).toHaveBeenCalledWith(
      "NOTION_DATA_SOURCE_ID",
      "content-ds",
      "/tmp/demo",
      ["content-ds"]
    );
  });
});
