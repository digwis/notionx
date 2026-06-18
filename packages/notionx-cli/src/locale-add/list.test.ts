// packages/notionx-cli/src/locale-add/list.test.ts
import { describe, expect, it } from "vitest";
import { buildLocaleListView } from "../../src/locale-add/list.js";
import type { ScaffoldMetadata } from "../../src/metadata.js";

const metadata: ScaffoldMetadata = {
  projectKind: "notionx",
  projectName: "demo",
  scaffoldVersion: "1.0.0",
  defaultLocale: "en",
  supportedLocales: ["en", "zh-CN"],
  notionxSource: "1.0.0",
  enableSiteSettings: true,
  contentSource: { id: "blog", title: "Blog", fields: [] },
};

describe("buildLocaleListView", () => {
  it("marks the default locale", () => {
    const view = buildLocaleListView({ metadata });
    expect(view.rows.find((r) => r.locale === "en")?.isDefault).toBe(true);
    expect(view.rows.find((r) => r.locale === "zh-CN")?.isDefault).toBe(
      false
    );
  });

  it("reports whether translation sources are configured", () => {
    const view = buildLocaleListView({
      metadata: {
        ...metadata,
        translationSources: {
          "blog-translations": {
            dataSourceId: "ds-1",
            envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
          },
        },
      },
    });
    const zhRow = view.rows.find((r) => r.locale === "zh-CN");
    const blogTs = zhRow?.translationSources.find(
      (ts) => ts.modelId === "blog-translations"
    );
    expect(blogTs?.configured).toBe(true);
    // Other built-in models stay unconfigured.
    const pagesTs = zhRow?.translationSources.find(
      (ts) => ts.modelId === "page-translations"
    );
    expect(pagesTs?.configured).toBe(false);
  });

  it("falls back to a synthesized env-var name for unconfigured sources", () => {
    const view = buildLocaleListView({ metadata });
    const blockTs = view.rows[1]?.translationSources.find(
      (ts) => ts.modelId === "block-translations"
    );
    expect(blockTs?.envVar).toBe(
      "NOTION_BLOCKS_TRANSLATIONS_DATA_SOURCE_ID"
    );
  });
});
