// packages/notionx-cli/tests/notion-translation-sources/plan.test.ts
import { describe, expect, it } from "vitest";
import { planNotionTranslationSources } from "../../src/notion-translation-sources/plan";

describe("planNotionTranslationSources", () => {
  it("returns one entry per built-in model with the right env-var name", () => {
    const plan = planNotionTranslationSources({
      locale: "zh-CN",
      copyFrom: "en",
      parentPageId: "page-1",
      apiToken: "secret-1",
      existingTranslationSources: {},
    });
    expect(plan).toHaveLength(4);
    expect(plan[0]).toMatchObject({
      modelId: "blog-translations",
      envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
      parentPageId: "page-1",
    });
  });

  it("reuses an existing translation source when one is already in metadata", () => {
    const plan = planNotionTranslationSources({
      locale: "zh-CN",
      parentPageId: "page-1",
      apiToken: "secret-1",
      existingTranslationSources: {
        "blog-translations": {
          dataSourceId: "ds-1",
          envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
        },
      },
    });
    const blog = plan.find((p) => p.modelId === "blog-translations");
    expect(blog?.action).toBe("reuse");
    expect(blog?.existingDataSourceId).toBe("ds-1");
  });

  it("plans a create + seed from copy-from when no existing source", () => {
    const plan = planNotionTranslationSources({
      locale: "zh-CN",
      copyFrom: "en",
      parentPageId: "page-1",
      apiToken: "secret-1",
      existingTranslationSources: {},
    });
    const blog = plan.find((p) => p.modelId === "blog-translations");
    expect(blog?.action).toBe("create");
    expect(blog?.copyFrom).toBe("en");
  });
});
