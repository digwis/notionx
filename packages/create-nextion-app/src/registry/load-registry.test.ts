// packages/create-nextion-app/src/registry/load-registry.test.ts

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadRegistry } from "./load-registry.js";
import { REGISTRY_FILE } from "./registry-store.js";
import { REGISTRY_SCHEMA_V2 } from "./registry-types.js";

describe("loadRegistry", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "notionx-load-"));
    await mkdir(path.join(dir, ".notionx"), { recursive: true });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("throws when no registry.json exists", async () => {
    await expect(loadRegistry(dir)).rejects.toThrow(/registry\.json/);
  });

  it("reads a v2 manifest directly", async () => {
    await writeFile(
      path.join(dir, REGISTRY_FILE),
      JSON.stringify({
        $schema: REGISTRY_SCHEMA_V2,
        projectKind: "notionx",
        projectName: "demo",
        scaffoldVersion: "1.0.0",
        notionxCore: "^2.0.0",
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
          fields: [{ key: "title", notionName: "Title" }],
        },
        compat: { mode: "v2-native" },
        registries: {},
        installed: [],
        managedFiles: { platform: [], bridge: [], user: [] },
      }),
      "utf8",
    );

    const result = await loadRegistry(dir);
    expect(result.manifest.$schema).toBe(REGISTRY_SCHEMA_V2);
    expect(result.manifest.projectName).toBe("demo");
    expect(result.managedFiles.platform).toEqual([]);
  });

  it("throws on schema mismatch", async () => {
    await writeFile(
      path.join(dir, REGISTRY_FILE),
      JSON.stringify({
        $schema: "https://example.com/wrong.json",
        projectKind: "notionx",
      }),
      "utf8",
    );

    await expect(loadRegistry(dir)).rejects.toThrow(/unknown schema/);
  });
});
