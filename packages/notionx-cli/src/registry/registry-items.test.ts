// packages/notionx-cli/src/registry/registry-items.test.ts
//
// The "official catalog". These items are what `notionx add <id>`
// resolves against. We test the shape (not the install behaviour,
// which is PR 3 territory) so a typo in a field gets caught here.

import { describe, expect, it } from "vitest";

import { listOfficialItems, getOfficialItem } from "./registry-items.js";

describe("official registry items", () => {
  it("exposes the full v2 starter set: blog, docs, site-settings, blocks, auth, admin, pages, search", () => {
    const ids = listOfficialItems().map((item) => item.id);
    expect(ids).toEqual([
      "blog",
      "docs",
      "site-settings",
      "blocks",
      "auth",
      "admin",
      "pages",
      "search",
    ]);
  });

  it("blog is a content-source with Notion as the data backend", () => {
    const blog = getOfficialItem("blog");
    expect(blog?.kind).toBe("content-source");
    expect(blog?.capabilities.contentSourceIds).toEqual(["blog"]);
    expect(blog?.capabilities.notionDataSources).toEqual([
      "NOTION_BLOG_DATA_SOURCE_ID",
    ]);
    expect(blog?.capabilities.envVars).toContain("NOTION_BLOG_DATA_SOURCE_ID");
  });

  it("docs is a content-source with a configurable basePath", () => {
    const docs = getOfficialItem("docs");
    expect(docs?.kind).toBe("content-source");
    expect(docs?.params.basePath).toBe("/docs");
    expect(docs?.capabilities.publicRoutes).toContain("/docs");
    expect(docs?.capabilities.publicRoutes).toContain("/docs/[slug]");
  });

  it("site-settings is a feature-module with enableSiteSettings flag", () => {
    const ss = getOfficialItem("site-settings");
    expect(ss?.kind).toBe("feature-module");
    expect(ss?.featureFlag).toBe("enableSiteSettings");
    expect(ss?.files.length).toBe(1);
    expect(ss?.files[0].fallbackTemplate).toBeTruthy();
  });

  it("blocks is a feature-module with enableBlocks flag", () => {
    const blocks = getOfficialItem("blocks");
    expect(blocks?.kind).toBe("feature-module");
    expect(blocks?.featureFlag).toBe("enableBlocks");
    expect(blocks?.files.length).toBe(5);
    const pageBlocks = blocks?.files.find((f) =>
      f.path.endsWith("page-blocks.tsx"),
    );
    expect(pageBlocks?.fallbackTemplate).toBeTruthy();
  });

  it("auth is a feature-module with enableAuth flag and fallback config", () => {
    const auth = getOfficialItem("auth");
    expect(auth?.kind).toBe("feature-module");
    expect(auth?.featureFlag).toBe("enableAuth");
    const config = auth?.files.find((f) => f.path === "lib/auth.config.ts");
    expect(config?.fallbackTemplate).toBeTruthy();
  });

  it("admin is a feature-module that requires auth", () => {
    const admin = getOfficialItem("admin");
    expect(admin?.kind).toBe("feature-module");
    expect(admin?.featureFlag).toBe("enableAdmin");
    expect(admin?.requires).toEqual([{ id: "auth", version: "^1.0.0" }]);
  });

  it("pages is a feature-module that requires blocks and has a fallback home page", () => {
    const pages = getOfficialItem("pages");
    expect(pages?.kind).toBe("feature-module");
    expect(pages?.featureFlag).toBe("enablePages");
    expect(pages?.requires).toEqual([{ id: "blocks", version: "^1.0.0" }]);
    const home = pages?.files.find((f) => f.path === "app/page.tsx");
    expect(home?.fallbackTemplate).toBeTruthy();
  });

  it("search is a feature-module with enableSearch flag and fallback config", () => {
    const search = getOfficialItem("search");
    expect(search?.kind).toBe("feature-module");
    expect(search?.featureFlag).toBe("enableSearch");
    expect(search?.requires).toBeUndefined();
    const config = search?.files.find((f) => f.path === "lib/search/config.ts");
    expect(config?.fallbackTemplate).toBeTruthy();
    expect(search?.capabilities.apiRoutes).toContain("/api/search");
    expect(search?.capabilities.d1Tables).toContain("content_search_index");
  });

  it("every item has a publishedAt timestamp and a non-empty migrations array slot", () => {
    for (const item of listOfficialItems()) {
      expect(item.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Array.isArray(item.migrations)).toBe(true);
    }
  });

  it("every file entry has a valid ownership tag", () => {
    const valid = new Set(["platform", "bridge", "user"]);
    for (const item of listOfficialItems()) {
      for (const file of item.files) {
        expect(valid.has(file.ownership)).toBe(true);
      }
    }
  });
});
