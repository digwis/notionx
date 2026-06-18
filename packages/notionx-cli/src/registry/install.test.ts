// packages/notionx-cli/src/registry/install.test.ts

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveStarterTemplatesDir } from "../render.js";
import { InstallError, installItem } from "./install.js";
import { REGISTRY_SCHEMA_V2 } from "./registry-types.js";

async function writePackageJson(
  projectDir: string,
  name: string,
  deps: Record<string, string> = {},
) {
  await writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({
      name,
      version: "0.0.0",
      private: true,
      dependencies: { "@notionx/core": "^2.0.0", ...deps },
    }),
    "utf8",
  );
}

async function writeV2Manifest(
  projectDir: string,
  installed: unknown[] = [
    {
      id: "blog",
      kind: "content-source",
      version: 1,
      source: { kind: "official", name: "@notionx/official" },
      params: { contentSourceId: "blog" },
      installedAt: "2026-06-10T00:00:00.000Z",
    },
  ],
  managedFiles: { platform?: string[]; bridge?: string[]; user?: string[] } = {},
) {
  await mkdir(path.join(projectDir, ".notionx"), { recursive: true });
  await writeFile(
    path.join(projectDir, ".notionx/registry.json"),
    JSON.stringify({
      $schema: REGISTRY_SCHEMA_V2,
      projectKind: "notionx",
      scaffoldVersion: "2.0.0",
      notionxCore: "^2.0.0",
      defaultLocale: "en",
      supportedLocales: ["en"],
      compat: { mode: "v2-native" },
      registries: {},
      installed,
      managedFiles: {
        platform: managedFiles.platform ?? ["package.json"],
        bridge: managedFiles.bridge ?? ["lib/notionx/content-registry.ts"],
        user: managedFiles.user ?? ["lib/content/models.ts", "app/blog/page.tsx"],
      },
    }),
    "utf8",
  );
}

describe("installItem", () => {
  let dir: string;
  let templatesDir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "notionx-install-"));
    await mkdir(path.join(dir, ".notionx"), { recursive: true });
    templatesDir = await resolveStarterTemplatesDir("blog");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("installs docs into a v2 project, writing all content source files and updating the manifest", async () => {
    await writePackageJson(dir, "demo");
    await writeV2Manifest(dir);

    const summary = await installItem({
      projectDir: dir,
      templatesDir,
      itemId: "docs",
    });

    expect(summary.item.id).toBe("docs");
    expect(summary.wroteManifest).toBe(true);
    expect(summary.rerenderedModels).toBe(true);
    expect(summary.files.map((f) => f.projectRelativePath)).toEqual([
      "app/docs/page.tsx",
      "app/docs/[slug]/page.tsx",
      "app/api/docs/route.ts",
      "app/api/docs/[slug]/route.ts",
    ]);

    // The list page landed on disk
    const listPath = path.join(dir, "app/docs/page.tsx");
    expect(existsSync(listPath)).toBe(true);
    const content = await fs.readFile(listPath, "utf8");
    // The list page references the new content source
    expect(content).toContain('"docs"');
    expect(content).toContain("/docs");

    // The detail page also landed
    expect(existsSync(path.join(dir, "app/docs/[slug]/page.tsx"))).toBe(true);

    // API routes landed
    expect(existsSync(path.join(dir, "app/api/docs/route.ts"))).toBe(true);
    expect(existsSync(path.join(dir, "app/api/docs/[slug]/route.ts"))).toBe(true);

    // The manifest was updated
    const manifestRaw = await fs.readFile(
      path.join(dir, ".notionx/registry.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      installed: Array<{ id: string; kind: string; files?: string[] }>;
    };
    expect(manifest.installed.map((i) => i.id).sort()).toEqual([
      "blog",
      "docs",
    ]);
    // InstalledItem stores the rendered file list
    const docsRecord = manifest.installed.find((i) => i.id === "docs");
    expect(docsRecord?.files).toEqual([
      "app/docs/page.tsx",
      "app/docs/[slug]/page.tsx",
      "app/api/docs/route.ts",
      "app/api/docs/[slug]/route.ts",
    ]);
  });

  it("rejects re-installing an item that is already present", async () => {
    await writePackageJson(dir, "demo");
    await writeV2Manifest(dir);

    await expect(
      installItem({ projectDir: dir, templatesDir, itemId: "blog" }),
    ).rejects.toThrow(/already installed/);
  });

  it("returns a followup list mentioning the NOTION_DOCS_DATA_SOURCE_ID env var", async () => {
    await writePackageJson(dir, "demo");
    await writeV2Manifest(dir);

    const summary = await installItem({
      projectDir: dir,
      templatesDir,
      itemId: "docs",
    });

    const joined = summary.followup.join("\n");
    expect(joined).toContain("NOTION_DOCS_DATA_SOURCE_ID");
  });

  it("rejects unknown item ids with the unknown-item code", async () => {
    await writePackageJson(dir, "demo");
    await writeV2Manifest(dir);

    try {
      await installItem({
        projectDir: dir,
        templatesDir,
        itemId: "nonexistent",
      });
      throw new Error("expected installItem to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(InstallError);
      expect((err as InstallError).code).toBe("unknown-item");
    }
  });

  it("dry-run does not write any file or update the manifest", async () => {
    await writePackageJson(dir, "demo");
    await writeV2Manifest(dir);
    const modelsPath = path.join(dir, "lib/content/models.ts");
    await mkdir(path.dirname(modelsPath), { recursive: true });
    const modelsBefore = "// existing models sentinel\n";
    await writeFile(modelsPath, modelsBefore, "utf8");

    const summary = await installItem({
      projectDir: dir,
      templatesDir,
      itemId: "docs",
      dryRun: true,
    });

    expect(summary.wroteManifest).toBe(false);
    expect(summary.files.map((f) => f.projectRelativePath)).toEqual([
      "app/docs/page.tsx",
      "app/docs/[slug]/page.tsx",
      "app/api/docs/route.ts",
      "app/api/docs/[slug]/route.ts",
    ]);
    expect(existsSync(path.join(dir, "app/docs/page.tsx"))).toBe(false);
    expect(await fs.readFile(modelsPath, "utf8")).toBe(modelsBefore);

    // Manifest unchanged
    const manifestRaw = await fs.readFile(
      path.join(dir, ".notionx/registry.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      installed: Array<{ id: string }>;
    };
    expect(manifest.installed).toHaveLength(1);
    expect(manifest.installed[0]?.id).toBe("blog");
  });

  it("preserves existing content sources when re-rendering models.ts", async () => {
    await writePackageJson(dir, "demo");
    await writeV2Manifest(dir);

    await installItem({ projectDir: dir, templatesDir, itemId: "docs" });

    const modelsPath = path.join(dir, "lib/content/models.ts");
    const models = await fs.readFile(modelsPath, "utf8");
    expect(models).toContain("blogSource");
    expect(models).toContain("docsSource");
    expect(models).toContain("siteSettingsSource");
    expect(models).toContain("blocksSource");
  });
});
