import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { defineContentModel } from "../content/model.ts";
import {
  createGenericNotionContentSource,
  mapNotionPageToGenericContentItem,
} from "./generic-source.ts";

const booksModel = defineContentModel({
  id: "books",
  kind: "catalog",
  visibility: {
    public: true,
    admin: false,
  },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_BOOKS_DATA_SOURCE_ID",
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
    query: {
      pageSize: 100,
      sorts: [{ property: "Published At", direction: "descending" }],
      filterProperties: [
        "Title",
        "Slug",
        "Summary",
        "Published At",
        "Tags",
        "Published",
        "Cover",
        "Difficulty",
      ],
    },
  },
  routes: {
    listPath: "/books",
    detailPath: "/books/[slug]",
    detailParam: "slug",
    publicApiPath: "/api/books",
  },
  ui: {
    name: "Book",
    pluralName: "Books",
    navLabel: "Books",
    listTitle: "Books",
    listDescription: "Books powered by Notion.",
    emptyState: "No books yet.",
  },
  capabilities: {
    richBlocks: true,
    coverImages: true,
    gatedAssets: false,
  },
});

test("generic Notion source stays independent from blog-specific mappers", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "..",
      "..",
      "packages",
      "foundation",
      "src",
      "notion",
      "generic-source.ts"
    ),
    "utf8"
  );

  assert.match(source, /property-mappers/);
  assert.doesNotMatch(source, /from "\.\/mappers/);
  assert.doesNotMatch(source, /blogContentModel/);
});

function bookPage({
  id,
  title,
  slug,
  date = "2026-06-07",
  published = true,
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

test("mapNotionPageToGenericContentItem maps configured fields", () => {
  const item = mapNotionPageToGenericContentItem(
    booksModel,
    bookPage({
      id: "book-1",
      title: "Invisible Cities",
      slug: "invisible-cities",
    })
  );

  assert.equal(item.title, "Invisible Cities");
  assert.equal(item.slug, "invisible-cities");
  assert.equal(item.description, "A book.");
  assert.equal(item.date, "2026-06-07");
  assert.deepEqual(item.tags, ["fiction", "notes"]);
  assert.equal(item.published, true);
  assert.deepEqual(item.properties.difficulty, ["medium"]);
});

test("createGenericNotionContentSource paginates, filters, sorts, and returns detail blocks", async () => {
  const calls = [];
  const source = createGenericNotionContentSource({
    model: booksModel,
    dataSourceId: "data-source-1",
    queryDataSource: async ({ startCursor } = {}) => {
      calls.push(startCursor ?? null);
      if (!startCursor) {
        return {
          results: [
            bookPage({
              id: "older",
              title: "Older",
              slug: "older",
              date: "2026-06-01",
            }),
            bookPage({
              id: "draft",
              title: "Draft",
              slug: "draft",
              published: false,
            }),
          ],
          has_more: true,
          next_cursor: "next",
        };
      }

      return {
        results: [
          bookPage({
            id: "newer",
            title: "Newer",
            slug: "newer",
            date: "2026-06-08",
          }),
        ],
      };
    },
    getPageBlocks: async (pageId) => [
      {
        id: `${pageId}-block`,
        type: "paragraph",
      },
    ],
  });

  const items = await source.listItems();
  const detail = await source.getItemBySlug("newer");

  assert.deepEqual(calls, [null, "next", null, "next"]);
  assert.deepEqual(
    items.map((item) => item.slug),
    ["newer", "older"]
  );
  assert.equal(detail?.blocks[0]?.id, "newer-block");
});
