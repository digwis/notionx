import { describe, expect, it } from "vitest";
import {
  createGenericNotionContentSource,
  mapNotionPageToGenericContentItem,
  type GenericContentSourceDeps,
} from "./generic-source";
import type { NotionPageLike } from "./types";
import { blogContract } from "../locale-contract/built-in";

function richText(content: string) {
  return {
    type: "rich_text",
    rich_text: [{ plain_text: content }],
  };
}

function title(content: string) {
  return {
    type: "title",
    title: [{ plain_text: content }],
  };
}

describe("generic source property mapping", () => {
  it("preserves select, number, and url extra fields in generic properties", () => {
    const page: NotionPageLike = {
      id: "page-id",
      properties: {
        Name: title("Hero Block"),
        Slug: richText("home-hero"),
        Description: richText("Homepage hero"),
        Status: { type: "select", select: { name: "Published" } },
        Type: { type: "select", select: { name: "hero" } },
        Columns: { type: "number", number: 3 },
        "Primary CTA Href": { type: "url", url: "/blog" },
      },
    };

    const item = mapNotionPageToGenericContentItem(
      {
        id: "blocks",
        source: {
          fields: {
            title: "Name",
            slug: "Slug",
            description: "Description",
            published: "Status",
            type: "Type",
            columns: "Columns",
            primaryCtaHref: "Primary CTA Href",
          },
        },
      },
      page
    );

    expect(item.properties.type).toBe("hero");
    expect(item.properties.columns).toBe(3);
    expect(item.properties.primaryCtaHref).toBe("/blog");
  });
});

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

describe("createGenericNotionContentSource locale-aware listing", () => {
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

    const deps: GenericContentSourceDeps = {
      model: {
        id: "blog",
        source: {
          fields: {
            title: "Title",
            slug: "Slug",
            published: "Status",
          },
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

    const source = createGenericNotionContentSource(deps);
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

    const deps: GenericContentSourceDeps = {
      model: {
        id: "blog",
        source: { fields: { title: "Title", slug: "Slug", published: "Status" } },
      },
      dataSourceId: "base-ds",
      queryDataSource: async () => ({ results: basePages }),
      getPageBlocks: async () => [],
    };

    const source = createGenericNotionContentSource(deps);
    const items = await source.listItems("zh-CN");
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Post One");
  });
});
