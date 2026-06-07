import test from "node:test";
import assert from "node:assert/strict";
import { createNotionPostSource } from "./posts.ts";

function page({ id, title, slug, published, date = "2026-06-07" }) {
  return {
    id,
    properties: {
      Title: { type: "title", title: [{ plain_text: title }] },
      Slug: { type: "rich_text", rich_text: [{ plain_text: slug }] },
      Description: { type: "rich_text", rich_text: [{ plain_text: "desc" }] },
      Date: { type: "date", date: { start: date } },
      Author: { type: "rich_text", rich_text: [{ plain_text: "zhao" }] },
      Tags: { type: "multi_select", multi_select: [] },
      Published: { type: "checkbox", checkbox: published },
    },
    cover: null,
  };
}

test("listPublishedPosts filters out unpublished and invalid rows", async () => {
  const source = createNotionPostSource({
    queryDataSource: async () => ({
      results: [
        page({ id: "1", title: "Public", slug: "public", published: true }),
        page({ id: "2", title: "Draft", slug: "draft", published: false }),
        page({ id: "3", title: "Bad Slug", slug: "Bad Slug", published: true }),
      ],
    }),
    getPageBlocks: async () => [],
  });

  const posts = await source.listPublishedPosts();

  assert.deepEqual(posts.map((post) => post.slug), ["public"]);
});

test("listPublishedPosts follows data source pagination", async () => {
  const calls = [];
  const source = createNotionPostSource({
    queryDataSource: async ({ startCursor } = {}) => {
      calls.push(startCursor ?? null);
      if (!startCursor) {
        return {
          results: [
            page({
              id: "1",
              title: "Older",
              slug: "older",
              published: true,
              date: "2026-06-06",
            }),
          ],
          has_more: true,
          next_cursor: "next",
        };
      }

      return {
        results: [
          page({
            id: "2",
            title: "Newer",
            slug: "newer",
            published: true,
            date: "2026-06-07",
          }),
        ],
        has_more: false,
        next_cursor: null,
      };
    },
    getPageBlocks: async () => [],
  });

  const posts = await source.listPublishedPosts();

  assert.deepEqual(calls, [null, "next"]);
  assert.deepEqual(posts.map((post) => post.slug), ["newer", "older"]);
});

test("getPublishedPostBySlug returns detail blocks for a matching slug", async () => {
  const source = createNotionPostSource({
    queryDataSource: async () => ({
      results: [page({ id: "1", title: "Public", slug: "public", published: true })],
    }),
    getPageBlocks: async (pageId) => [
      {
        id: `${pageId}-block`,
        type: "paragraph",
        paragraph: { rich_text: [{ plain_text: "Hello" }] },
      },
    ],
  });

  const post = await source.getPublishedPostBySlug("public");

  assert.equal(post?.title, "Public");
  assert.equal(post?.blocks[0]?.id, "1-block");
});

test("getPublishedPostBySlug returns null when a slug is absent", async () => {
  const source = createNotionPostSource({
    queryDataSource: async () => ({ results: [] }),
    getPageBlocks: async () => [],
  });

  assert.equal(await source.getPublishedPostBySlug("missing"), null);
});
