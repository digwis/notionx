// packages/notionx-cli/src/registry/registry-types.test.ts
//
// Pure type-shape tests. No fs / no Node APIs. These exist to lock in
// the JSON shape we read/write on disk so a refactor that accidentally
// renames a field is caught immediately.

import { describe, expect, it } from "vitest";

import {
  REGISTRY_SCHEMA_V2,
  type InstalledItem,
  type RegistryItem,
  type RegistryManifest,
} from "./registry-types.js";

/** Minimal valid manifest fixture with overridable fields. */
function fixture(overrides: Partial<RegistryManifest> = {}): RegistryManifest {
  return {
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
    ...overrides,
  };
}

describe("RegistryManifest", () => {
  it("uses the v2 schema URL", () => {
    const manifest = fixture({
      registries: {
        "@notionx/official": { url: "https://registry.notionx.dev/official.json" },
      },
    });

    expect(manifest.$schema).toBe("https://notionx.dev/schemas/registry.v2.json");
  });

  it("supports the legacy-vinext compatibility marker", () => {
    const manifest = fixture({
      notionxCore: "workspace:*",
      compat: { mode: "legacy-vinext" },
    });

    expect(manifest.compat.mode).toBe("legacy-vinext");
    expect(manifest.notionxCore).toBe("workspace:*");
  });

  it("preserves extras through the round-trip", () => {
    const manifest = fixture({
      extras: { customBindingName: "D1_AUTH_DB" },
    });

    expect(manifest.extras?.customBindingName).toBe("D1_AUTH_DB");
  });

  it("stores projectName and contentSource from the scaffold flow", () => {
    const manifest = fixture({
      projectName: "my-site",
      contentSource: {
        id: "docs",
        title: "Docs",
        fields: [
          { key: "title", notionName: "Title" },
          { key: "slug", notionName: "Slug" },
        ],
      },
    });

    expect(manifest.projectName).toBe("my-site");
    expect(manifest.contentSource.id).toBe("docs");
    expect(manifest.contentSource.fields).toHaveLength(2);
  });
});

describe("InstalledItem", () => {
  it("captures the four fields the loader snapshots", () => {
    const installed: InstalledItem = {
      id: "blog",
      kind: "content-source",
      version: 1,
      source: { kind: "official", name: "@notionx/official" },
      params: { contentSourceId: "blog" },
      installedAt: "2026-06-10T08:00:00.000Z",
    };

    expect(installed.id).toBe("blog");
    expect(installed.kind).toBe("content-source");
    expect(installed.source.kind).toBe("official");
  });
});

describe("RegistryItem", () => {
  it("models requires / supersedes / migrations as optional", () => {
    const item: RegistryItem = {
      id: "search",
      kind: "feature-module",
      version: 1,
      source: { kind: "official", name: "@notionx/official" },
      publishedAt: "2026-06-10T00:00:00.000Z",
      params: { scope: "docs" },
      files: [],
      capabilities: {},
      migrations: [],
    };

    expect(item.requires).toBeUndefined();
    expect(item.supersedes).toBeUndefined();
    expect(item.migrations).toEqual([]);
  });

  it("supports content-source items with notion data sources", () => {
    const blog: RegistryItem = {
      id: "blog",
      kind: "content-source",
      version: 1,
      source: { kind: "official", name: "@notionx/official" },
      publishedAt: "2026-06-01T00:00:00.000Z",
      params: { contentSourceId: "blog" },
      files: [
        { path: "app/blog/page.tsx", ownership: "user" },
        { path: "lib/content/models.ts", ownership: "bridge" },
      ],
      capabilities: {
        publicRoutes: ["/blog", "/blog/[slug]"],
        apiRoutes: ["/api/posts"],
        envVars: ["NOTION_BLOG_DATA_SOURCE_ID"],
        notionDataSources: ["NOTION_BLOG_DATA_SOURCE_ID"],
        contentSourceIds: ["blog"],
      },
      migrations: [
        {
          from: "blog@1",
          to: "blog@2",
          steps: [
            {
              kind: "notion-field-add",
              source: "NOTION_BLOG_DATA_SOURCE_ID",
              property: "Author",
              type: "people",
            },
          ],
        },
      ],
    };

    expect(blog.capabilities.contentSourceIds).toEqual(["blog"]);
    expect(blog.migrations[0]?.steps[0]?.kind).toBe("notion-field-add");
  });
});
