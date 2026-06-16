// packages/create-nextion-app/src/registry/render-multi-source.test.ts

import { describe, expect, it } from "vitest";

import { buildMultiSourceTokenMap } from "./render-multi-source.js";
import type { InstalledItem, RegistryItem } from "./registry-types.js";

const OFFICIAL: RegistryItem["source"] = {
  kind: "official",
  name: "@notionx/official",
};

function item(
  id: string,
  params: Record<string, string> = {},
): InstalledItem {
  return {
    id,
    kind: "content-source",
    version: 1,
    source: OFFICIAL,
    params,
    installedAt: "2026-06-10T00:00:00.000Z",
  };
}

const DEFAULT_PROJECT = {
  projectName: "demo",
  targetDir: "./demo",
  defaultLocale: "en",
  supportedLocales: ["en"],
  nextionSource: "^2.0.0",
  adminEmail: "admin@example.com",
  adminPassword: "Password123",
  scaffoldVersion: "0.7.2",
};

describe("buildMultiSourceTokenMap", () => {
  it("renders a single source (blog) with per-source and block tokens", () => {
    const tokens = buildMultiSourceTokenMap({
      project: DEFAULT_PROJECT,
      installed: [item("blog", { contentSourceId: "blog" })],
    });

    // Per-source tokens (derived from the primary source).
    expect(tokens.contentSourceId).toBe("blog");
    expect(tokens.contentSourceVarName).toBe("blogSource");
    expect(tokens.contentSourceListPath).toBe("/blog");

    // The declarations block contains the same source.
    expect(tokens.contentSourceDeclarations).toContain("blogSource");
    expect(tokens.contentSourceDeclarations).toContain('id: "blog"');
  });

  it("renders two sources (blog + docs) and produces a unified declarations block", () => {
    const tokens = buildMultiSourceTokenMap({
      project: DEFAULT_PROJECT,
      installed: [
        item("blog", { contentSourceId: "blog" }),
        item("docs", { contentSourceId: "docs", basePath: "/docs" }),
      ],
    });

    // Both sources are referenced in the declarations block.
    expect(tokens.contentSourceDeclarations).toContain("blogSource");
    expect(tokens.contentSourceDeclarations).toContain("docsSource");
    expect(tokens.contentSourceDeclarations).toContain('id: "blog"');
    expect(tokens.contentSourceDeclarations).toContain('id: "docs"');

    // The block is **ordered by id** for deterministic diffs
    // (alphabetical when no explicit order is given).
    const blogIdx = tokens.contentSourceDeclarations.indexOf("blogSource");
    const docsIdx = tokens.contentSourceDeclarations.indexOf("docsSource");
    expect(blogIdx).toBeGreaterThan(-1);
    expect(docsIdx).toBeGreaterThan(blogIdx);

    // The var-names token is a comma-joined list of `*Source` names.
    expect(tokens.contentSourceSourcesVarNames).toBe("blogSource, docsSource");
  });

  it("honors a custom basePath param for content sources (docs at /docs)", () => {
    const tokens = buildMultiSourceTokenMap({
      project: DEFAULT_PROJECT,
      installed: [item("docs", { contentSourceId: "docs", basePath: "/docs" })],
    });

    // The declarations block reflects the custom basePath.
    expect(tokens.contentSourceDeclarations).toContain('listPath: "/docs"');
    expect(tokens.contentSourceDeclarations).toContain(
      'detailPath: "/docs/[slug]"',
    );
  });

  it("treats feature-modules (e.g. search) as separate from content-source arrays", () => {
    const tokens = buildMultiSourceTokenMap({
      project: DEFAULT_PROJECT,
      installed: [
        item("docs", { contentSourceId: "docs" }),
        {
          id: "search",
          kind: "feature-module",
          version: 1,
          source: OFFICIAL,
          params: { scope: "docs" },
          installedAt: "2026-06-10T00:00:00.000Z",
        },
      ],
    });

    // docs is a content-source → its source block is emitted
    expect(tokens.contentSourceDeclarations).toContain("docsSource");
    expect(tokens.contentSourceDeclarations).toContain('id: "docs"');

    // search is a feature-module → not in the content-source array
    expect(tokens.contentSourceDeclarations).not.toContain("searchSource");
  });

  it("throws if no content-source items are installed (must have at least one)", () => {
    expect(() =>
      buildMultiSourceTokenMap({
        project: DEFAULT_PROJECT,
        installed: [],
      }),
    ).toThrow(/at least one content-source/);
  });

  it("throws on duplicate content-source ids", () => {
    expect(() =>
      buildMultiSourceTokenMap({
        project: DEFAULT_PROJECT,
        installed: [
          item("blog", { contentSourceId: "blog" }),
          item("blog", { contentSourceId: "blog" }),
        ],
      }),
    ).toThrow(/duplicate/i);
  });
});
