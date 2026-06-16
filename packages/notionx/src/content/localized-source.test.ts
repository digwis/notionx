import { describe, expect, it } from "vitest";
import {
  createLocalizedGenericNotionContentSource,
  type LocalizedGenericContentSourceDeps,
} from "./localized-source";
import { blogContract } from "../locale-contract/built-in";
import type { NotionPageLike } from "../notion/types";

function translationPage(
  sourceId: string,
  locale: string,
  slug: string,
  title: string
): NotionPageLike {
  return {
    id: `trans-${sourceId}-${locale}`,
    properties: {
      Title: { type: "title", title: [{ plain_text: title }] },
      Source: { type: "relation", relation: [{ id: sourceId }] },
      Locale: { type: "select", select: { name: locale } },
      Slug: { type: "rich_text", rich_text: [{ plain_text: slug }] },
      Published: { type: "checkbox", checkbox: true },
    },
  };
}

describe("createLocalizedGenericNotionContentSource", () => {
  it("hides base items that lack a translation for the requested locale (hide rule)", async () => {
    const basePages: NotionPageLike[] = [
      {
        id: "base-1",
        properties: {
          Title: { type: "title", title: [{ plain_text: "Post One" }] },
          Slug: { type: "rich_text", rich_text: [{ plain_text: "post-one" }] },
          Status: { type: "select", select: { name: "Published" } },
        },
      },
      {
        id: "base-2",
        properties: {
          Title: { type: "title", title: [{ plain_text: "Post Two" }] },
          Slug: { type: "rich_text", rich_text: [{ plain_text: "post-two" }] },
          Status: { type: "select", select: { name: "Published" } },
        },
      },
    ];
    const translationPages: NotionPageLike[] = [
      translationPage("base-1", "zh-CN", "post-one", "第一篇"),
    ];

    const deps: LocalizedGenericContentSourceDeps = {
      model: {
        id: "blog",
        source: {
          tokenEnv: "NOTION_TOKEN",
          dataSourceEnv: "NOTION_DATA_SOURCE_ID",
          fields: {
            title: "Title",
            slug: "Slug",
            published: "Status",
          },
          query: { pageSize: 10 },
        },
      },
      dataSourceId: "base-ds",
      queryDataSource: async () => ({ results: basePages }),
      getPageBlocks: async () => [],
      translationSourceId: "trans-ds",
      translationQueryDataSource: async () => ({ results: translationPages }),
      contract: blogContract,
      defaultLocale: "en",
      supportedLocales: ["en", "zh-CN"],
    };

    const source = createLocalizedGenericNotionContentSource(deps);
    const zhItems = await source.listItems("zh-CN");
    expect(zhItems).toHaveLength(1);
    expect(zhItems[0]!.title).toBe("第一篇");

    const enItems = await source.listItems("en");
    expect(enItems).toHaveLength(2);
    expect(enItems[0]!.title).toBe("Post One");
  });

  it("returns base items unchanged when no translation source is configured", async () => {
    const basePages: NotionPageLike[] = [
      {
        id: "base-1",
        properties: {
          Title: { type: "title", title: [{ plain_text: "Post One" }] },
          Slug: { type: "rich_text", rich_text: [{ plain_text: "post-one" }] },
          Status: { type: "select", select: { name: "Published" } },
        },
      },
    ];

    const deps: LocalizedGenericContentSourceDeps = {
      model: {
        id: "blog",
        source: {
          tokenEnv: "NOTION_TOKEN",
          dataSourceEnv: "NOTION_DATA_SOURCE_ID",
          fields: { title: "Title", slug: "Slug", published: "Status" },
          query: { pageSize: 10 },
        },
      },
      dataSourceId: "base-ds",
      queryDataSource: async () => ({ results: basePages }),
      getPageBlocks: async () => [],
    };

    const source = createLocalizedGenericNotionContentSource(deps);
    const items = await source.listItems("zh-CN");
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Post One");
  });
});
