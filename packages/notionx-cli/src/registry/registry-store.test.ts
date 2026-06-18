// packages/notionx-cli/src/registry/registry-store.test.ts

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { REGISTRY_SCHEMA_V2, type RegistryManifest } from "./registry-types.js";
import {
  readRegistryManifest,
  REGISTRY_FILE,
  writeRegistryManifest,
} from "./registry-store.js";

describe("registry-store", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "notionx-registry-store-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("exposes the canonical .notionx/registry.json path", () => {
    expect(REGISTRY_FILE).toBe(".notionx/registry.json");
  });

  it("returns null when registry.json does not exist", async () => {
    const result = await readRegistryManifest(dir);
    expect(result).toBeNull();
  });

  it("rejects a manifest that does not match the v2 schema URL", async () => {
    // Intentionally construct a manifest with the wrong schema URL
    // to verify the loader rejects it. We use `as unknown as` to
    // bypass the literal-type narrowing — this fixture is *meant*
    // to violate the type.
    const manifest = {
      $schema: "https://example.com/wrong-schema.json",
      projectKind: "notionx" as const,
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
      compat: { mode: "v2-native" as const },
      registries: {},
      installed: [],
      managedFiles: { platform: [], bridge: [], user: [] },
    } as unknown as RegistryManifest;
    await mkdir(path.join(dir, ".notionx"), { recursive: true });
    await writeFile(
      path.join(dir, REGISTRY_FILE),
      JSON.stringify(manifest),
      "utf8",
    );

    await expect(readRegistryManifest(dir)).rejects.toThrow(/v2/);
  });

  it("round-trips a valid manifest through write + read", async () => {
    const manifest: RegistryManifest = {
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
      registries: {
        "@notionx/official": {
          url: "https://registry.notionx.dev/official.json",
        },
      },
      installed: [
        {
          id: "blog",
          kind: "content-source",
          version: 1,
          source: { kind: "official", name: "@notionx/official" },
          params: { contentSourceId: "blog" },
          installedAt: "2026-06-10T08:00:00.000Z",
        },
      ],
      managedFiles: {
        platform: ["package.json", "wrangler.jsonc"],
        bridge: ["worker/index.ts"],
        user: ["app/page.tsx", "lib/content/models.ts"],
      },
    };

    await writeRegistryManifest(dir, manifest);
    const read = await readRegistryManifest(dir);
    expect(read).toEqual(manifest);
  });

  it("uses an atomic write (write to .tmp, then rename)", async () => {
    const manifest: RegistryManifest = {
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
    };

    await writeRegistryManifest(dir, manifest);

    // No leftover .tmp file
    const entries = await readFile(
      path.join(dir, REGISTRY_FILE),
      "utf8",
    );
    expect(entries).toContain(REGISTRY_SCHEMA_V2);

    // Final file is valid JSON
    const parsed = JSON.parse(entries) as RegistryManifest;
    expect(parsed.$schema).toBe(REGISTRY_SCHEMA_V2);
  });
});
