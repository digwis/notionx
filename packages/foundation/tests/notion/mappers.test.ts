import { describe, it, expect } from "vitest";
import { mapNotionPageToGenericContentItem } from "../../src/notion/generic-source";

type NotionFieldMap = Record<string, string | readonly string[]>;

type ContentModelLike = {
  id: string;
  source: {
    fields: NotionFieldMap;
  };
};

const booksModel = {
  id: "books",
  source: {
    fields: {
      title: "Title",
      slug: "Slug",
      description: "Summary",
      date: "Published At",
      tags: "Tags",
      published: "Published",
      cover: "Cover",
      difficulty: "Difficulty",
    },
  },
} satisfies ContentModelLike;

function bookPage({
  id,
  title,
  slug,
  date = "2026-06-07",
  published = true,
}: {
  id: string;
  title: string;
  slug: string;
  date?: string;
  published?: boolean;
}) {
  return {
    id,
    properties: {
      Title: { type: "title", title: [{ plain_text: title }] },
      Slug: { type: "rich_text", rich_text: [{ plain_text: slug }] },
      Summary: { type: "rich_text", rich_text: [{ plain_text: "A book." }] },
      "Published At": { type: "date", date: { start: date } },
      Tags: {
        type: "multi_select",
        multi_select: [{ name: "fiction" }, { name: "notes" }],
      },
      Published: { type: "checkbox", checkbox: published },
      Difficulty: { type: "select", select: { name: "medium" } },
    },
    cover: null,
  };
}

describe("mapNotionPageToGenericContentItem", () => {
  it("maps configured fields from a Notion page", () => {
    const item = mapNotionPageToGenericContentItem(
      booksModel as unknown as Parameters<typeof mapNotionPageToGenericContentItem>[0],
      bookPage({
        id: "book-1",
        title: "Invisible Cities",
        slug: "invisible-cities",
      })
    );

    expect(item.title).toBe("Invisible Cities");
    expect(item.slug).toBe("invisible-cities");
    expect(item.description).toBe("A book.");
    expect(item.date).toBe("2026-06-07");
    expect(item.tags).toEqual(["fiction", "notes"]);
    expect(item.published).toBe(true);
  });
});
