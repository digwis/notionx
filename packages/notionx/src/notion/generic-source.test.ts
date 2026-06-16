import { describe, expect, it } from "vitest";
import {
  mapNotionPageToGenericContentItem,
} from "./generic-source";
import type { NotionPageLike } from "./types";

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
