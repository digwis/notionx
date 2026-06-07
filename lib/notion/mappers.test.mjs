import test from "node:test";
import assert from "node:assert/strict";
import {
  getAuthorProperty,
  mapNotionPageToListItem,
  pickDescriptionFallback,
  pickPublishedFlag,
} from "./mappers.ts";

test("pickPublishedFlag accepts a Published checkbox", () => {
  assert.equal(
    pickPublishedFlag({
      Published: { type: "checkbox", checkbox: true },
    }),
    true
  );
});

test("pickPublishedFlag accepts Status=Published case-insensitively", () => {
  assert.equal(
    pickPublishedFlag({
      Status: { type: "status", status: { name: "published" } },
    }),
    true
  );
});

test("pickDescriptionFallback uses title when description is empty", () => {
  assert.equal(pickDescriptionFallback("", "Hello Notion"), "Hello Notion");
});

test("getAuthorProperty accepts people properties", () => {
  assert.equal(
    getAuthorProperty(
      {
        Author: {
          type: "people",
          people: [
            { name: "Zhao" },
            { person: { email: "editor@example.com" } },
          ],
        },
      },
      "Author"
    ),
    "Zhao, editor@example.com"
  );
});

test("mapNotionPageToListItem maps a published row into app fields", () => {
  const row = {
    id: "page-1",
    properties: {
      Title: {
        type: "title",
        title: [{ plain_text: "Notion Intro" }],
      },
      Slug: {
        type: "rich_text",
        rich_text: [{ plain_text: "notion-intro" }],
      },
      Description: {
        type: "rich_text",
        rich_text: [{ plain_text: "A short intro" }],
      },
      Date: {
        type: "date",
        date: { start: "2026-06-07" },
      },
      Author: {
        type: "rich_text",
        rich_text: [{ plain_text: "zhao" }],
      },
      Tags: {
        type: "multi_select",
        multi_select: [{ name: "cloudflare" }, { name: "notion" }],
      },
      Published: {
        type: "checkbox",
        checkbox: true,
      },
      Cover: {
        type: "files",
        files: [
          {
            type: "external",
            external: { url: "https://example.com/cover.jpg" },
          },
        ],
      },
    },
    cover: null,
  };

  assert.deepEqual(mapNotionPageToListItem(row), {
    pageId: "page-1",
    slug: "notion-intro",
    title: "Notion Intro",
    description: "A short intro",
    date: "2026-06-07",
    author: "zhao",
    tags: ["cloudflare", "notion"],
    coverImage: "https://example.com/cover.jpg",
    published: true,
    editUrl: "https://www.notion.so/page1",
  });
});

test("mapNotionPageToListItem uses stable path for Notion-hosted covers", () => {
  const post = mapNotionPageToListItem({
    id: "page-2",
    properties: {
      Title: { type: "title", title: [{ plain_text: "With Cover" }] },
      Slug: { type: "rich_text", rich_text: [{ plain_text: "with-cover" }] },
      Date: { type: "date", date: { start: "2026-06-07" } },
      Published: { type: "checkbox", checkbox: true },
    },
    cover: {
      type: "file",
      file: {
        url: "https://secure.notion-static.com/signed.jpg",
        expiry_time: "2026-06-07T12:00:00.000Z",
      },
    },
  });

  assert.equal(post.coverImage, "/api/notion/media/page/page-2/cover");
});
