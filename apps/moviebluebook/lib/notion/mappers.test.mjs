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
    last_edited_time: "2026-06-09T02:00:00.000Z",
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
    updatedAt: "2026-06-09T02:00:00.000Z",
    slug: "notion-intro",
    title: "Notion Intro",
    description: "A short intro",
    date: "2026-06-07",
    author: "zhao",
    tags: ["cloudflare", "notion"],
    coverImage: "/api/notion/media/page/page-1/property/Cover?v=2026-06-09T02%3A00%3A00.000Z",
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

test("mapNotionPageToListItem maps a minimal Chinese article database row", () => {
  const post = mapNotionPageToListItem({
    id: "379dc62d-0738-80b7-9890-f928f94435a3",
    created_time: "2026-06-08T12:00:00.000Z",
    last_edited_time: "2026-06-08T14:30:00.000Z",
    properties: {
      标题: {
        type: "title",
        title: [{ plain_text: "ACP：AI 时代的 Agent 接入标准" }],
      },
      网址: {
        type: "url",
        url: "https://fanlv.fun/2026/06/08/acp/",
      },
    },
    cover: null,
  });

  assert.deepEqual(post, {
    pageId: "379dc62d-0738-80b7-9890-f928f94435a3",
    updatedAt: "2026-06-08T14:30:00.000Z",
    slug: "379dc62d073880b79890f928f94435a3",
    title: "ACP：AI 时代的 Agent 接入标准",
    description: "ACP：AI 时代的 Agent 接入标准",
    date: "2026-06-08",
    author: "Unknown",
    tags: [],
    coverImage: null,
    published: true,
    editUrl: "https://www.notion.so/379dc62d073880b79890f928f94435a3",
  });
});
