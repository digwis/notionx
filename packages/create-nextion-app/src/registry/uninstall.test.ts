// packages/create-nextion-app/src/registry/uninstall.test.ts

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveTemplatesDir } from "../render.js";
import { installItem } from "./install.js";
import { REGISTRY_SCHEMA_V2 } from "./registry-types.js";
import { UninstallError, uninstallItem } from "./uninstall.js";

async function writePackageJson(
  projectDir: string,
  name: string,
) {
  await writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({
      name,
      version: "0.0.0",
      private: true,
      dependencies: { "@notionx/core": "^2.0.0" },
    }),
    "utf8",
  );
}

async function writeV2ManifestWith(
  projectDir: string,
  installed: Array<Record<string, unknown>>,
  managedFiles: { platform?: string[]; bridge?: string[]; user?: string[] } = {},
  overrides: Record<string, unknown> = {},
) {
  await mkdir(path.join(projectDir, ".notionx"), { recursive: true });
  await writeFile(
    path.join(projectDir, ".notionx/registry.json"),
    JSON.stringify({
      $schema: REGISTRY_SCHEMA_V2,
      projectKind: "notionx",
      projectName: "demo",
      scaffoldVersion: "2.0.0",
      notionxCore: "^2.0.0",
      defaultLocale: "en",
      supportedLocales: ["en"],
      enableSiteSettings: true,
      enableBlocks: true,
      enableSearch: true,
      contentSource: {
        id: "blog",
        title: "Blog",
        fields: [],
      },
      compat: { mode: "v2-native" },
      registries: {},
      installed,
      managedFiles: {
        platform: managedFiles.platform ?? ["package.json"],
        bridge: managedFiles.bridge ?? [],
        user: managedFiles.user ?? [],
      },
      ...overrides,
    }),
    "utf8",
  );
}

describe("uninstallItem", () => {
  let dir: string;
  let templatesDir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "notionx-uninstall-"));
    await mkdir(path.join(dir, ".notionx"), { recursive: true });
    templatesDir = await resolveTemplatesDir();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("removes docs from a v2 project and updates the manifest + models.ts", async () => {
    await writePackageJson(dir, "demo");
    await writeV2ManifestWith(dir, [
      {
        id: "blog",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
      {
        id: "docs",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "docs", basePath: "/docs" },
        installedAt: "2026-06-10T08:00:00.000Z",
      },
    ]);

    const summary = await uninstallItem({
      projectDir: dir,
      templatesDir,
      itemId: "docs",
    });

    expect(summary.removedItem.id).toBe("docs");
    expect(summary.wroteManifest).toBe(true);
    expect(summary.rerenderedModels).toBe(true);

    const manifestRaw = await fs.readFile(
      path.join(dir, ".notionx/registry.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      installed: Array<{ id: string }>;
    };
    expect(manifest.installed.map((i) => i.id)).toEqual(["blog"]);

    const models = await fs.readFile(
      path.join(dir, "lib/content/models.ts"),
      "utf8",
    );
    expect(models).toContain("blogSource");
    expect(models).not.toContain("docsSource");
  });

  it("rejects removing an item that is not installed", async () => {
    await writePackageJson(dir, "demo");
    await writeV2ManifestWith(dir, [
      {
        id: "blog",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    try {
      await uninstallItem({ projectDir: dir, templatesDir, itemId: "docs" });
      throw new Error("expected uninstallItem to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UninstallError);
      expect((err as UninstallError).code).toBe("not-installed");
    }
  });

  it("round-trip: install docs, then remove docs, leaves blog intact", async () => {
    await writePackageJson(dir, "demo");
    await writeV2ManifestWith(dir, [
      {
        id: "blog",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    await installItem({ projectDir: dir, templatesDir, itemId: "docs" });
    expect(existsSync(path.join(dir, "app/docs/page.tsx"))).toBe(true);

    const summary = await uninstallItem({
      projectDir: dir,
      templatesDir,
      itemId: "docs",
    });
    expect(summary.removedItem.id).toBe("docs");

    const manifestRaw = await fs.readFile(
      path.join(dir, ".notionx/registry.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      installed: Array<{ id: string }>;
    };
    expect(manifest.installed.map((i) => i.id)).toEqual(["blog"]);

    // The Notion data source is *not* touched; the followup
    // mentions how to clean it up manually.
    const joined = summary.followup.join("\n");
    expect(joined).toContain("Notion");
  });

  it("dry-run does not write the manifest", async () => {
    await writePackageJson(dir, "demo");
    await writeV2ManifestWith(dir, [
      {
        id: "blog",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
      {
        id: "docs",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "docs", basePath: "/docs" },
        installedAt: "2026-06-10T08:00:00.000Z",
      },
    ]);

    const summary = await uninstallItem({
      projectDir: dir,
      templatesDir,
      itemId: "docs",
      dryRun: true,
    });

    expect(summary.wroteManifest).toBe(false);

    // Manifest is unchanged
    const manifestRaw = await fs.readFile(
      path.join(dir, ".notionx/registry.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      installed: Array<{ id: string }>;
    };
    expect(manifest.installed.map((i) => i.id).sort()).toEqual([
      "blog",
      "docs",
    ]);
  });

  it("feature-module: uninstalling site-settings renders fallback + flips flag", async () => {
    await writePackageJson(dir, "demo");
    await writeV2ManifestWith(
      dir,
      [
        {
          id: "blog",
          kind: "content-source",
          version: 1,
          source: { kind: "official", name: "@notionx/official" },
          params: { contentSourceId: "blog" },
          installedAt: "2026-06-10T00:00:00.000Z",
        },
        {
          id: "site-settings",
          kind: "feature-module",
          version: 1,
          source: { kind: "official", name: "@notionx/official" },
          params: {},
          installedAt: "2026-06-10T00:00:00.000Z",
          files: ["lib/site/settings.ts"],
        },
      ],
      {
        bridge: ["lib/site/settings.ts"],
      },
    );

    const summary = await uninstallItem({
      projectDir: dir,
      templatesDir,
      itemId: "site-settings",
    });

    expect(summary.removedItem.id).toBe("site-settings");
    expect(summary.fallbackRenderedFiles).toContain("lib/site/settings.ts");
    expect(summary.deletedFiles).toEqual([]);

    // The manifest flag should be flipped to false.
    const manifestRaw = await fs.readFile(
      path.join(dir, ".notionx/registry.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      installed: Array<{ id: string }>;
      enableSiteSettings: boolean;
    };
    expect(manifest.installed.map((i) => i.id)).toEqual(["blog"]);
    expect(manifest.enableSiteSettings).toBe(false);

    // models.ts should no longer declare siteSettingsSource.
    const models = await fs.readFile(
      path.join(dir, "lib/content/models.ts"),
      "utf8",
    );
    expect(models).not.toContain(
      'export const siteSettingsSource',
    );
    expect(models).not.toContain('"site-settings"');

    // The fallback file should be rendered (it returns the
    // fallback site config directly).
    const settings = await fs.readFile(
      path.join(dir, "lib/site/settings.ts"),
      "utf8",
    );
    expect(settings).toContain("fallbackSiteConfig");

    // Followup should mention the fallback is active.
    const joined = summary.followup.join("\n");
    expect(joined).toContain("fallback");
  });

  it("feature-module: dry-run reports fallback files without writing", async () => {
    await writePackageJson(dir, "demo");
    await writeV2ManifestWith(
      dir,
      [
        {
          id: "blog",
          kind: "content-source",
          version: 1,
          source: { kind: "official", name: "@notionx/official" },
          params: { contentSourceId: "blog" },
          installedAt: "2026-06-10T00:00:00.000Z",
        },
        {
          id: "blocks",
          kind: "feature-module",
          version: 1,
          source: { kind: "official", name: "@notionx/official" },
          params: {},
          installedAt: "2026-06-10T00:00:00.000Z",
          files: ["components/page-blocks.tsx"],
        },
      ],
      {
        bridge: ["components/page-blocks.tsx"],
      },
    );

    const summary = await uninstallItem({
      projectDir: dir,
      templatesDir,
      itemId: "blocks",
      dryRun: true,
    });

    expect(summary.wroteManifest).toBe(false);
    expect(summary.fallbackRenderedFiles).toContain(
      "components/page-blocks.tsx",
    );

    // Manifest unchanged.
    const manifestRaw = await fs.readFile(
      path.join(dir, ".notionx/registry.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      enableBlocks: boolean;
    };
    expect(manifest.enableBlocks).toBe(true);
  });
});
