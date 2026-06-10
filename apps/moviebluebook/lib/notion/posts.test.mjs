import test from "node:test";
import assert from "node:assert/strict";
import { createNotionPostSource } from "./posts.ts";

function page({
  id,
  title,
  slug,
  published,
  date = "2026-06-07",
  updatedAt,
}) {
  return {
    id,
    ...(updatedAt ? { last_edited_time: updatedAt } : {}),
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

  assert.deepEqual(posts.map((post) => post.slug), ["public", "3"]);
});

test("listPublishedPosts falls back to page id when slug is missing", async () => {
  const source = createNotionPostSource({
    queryDataSource: async () => ({
      results: [
        page({ id: "fallback-page", title: "No Slug", slug: "", published: true }),
      ],
    }),
    getPageBlocks: async () => [],
  });

  const posts = await source.listPublishedPosts();

  assert.deepEqual(posts.map((post) => post.slug), ["fallbackpage"]);
});

test("listPublishedPosts uses the first body image when cover is missing", async () => {
  const source = createNotionPostSource({
    queryDataSource: async () => ({
      results: [
        page({
          id: "fallback-cover",
          title: "Body Cover",
          slug: "body-cover",
          published: true,
        }),
      ],
    }),
    getPageBlocks: async () => [
      {
        id: "body-image",
        type: "image",
        image: {
          type: "file",
          file: {
            url: "https://secure.notion-static.com/signed.jpg",
            expiry_time: "2026-06-07T12:00:00.000Z",
          },
        },
      },
    ],
  });

  const posts = await source.listPublishedPosts();

  assert.equal(posts[0]?.coverImage, "/api/notion/media/block/body-image");
});

test("listPublishedPosts keeps explicit cover without reading blocks", async () => {
  let blockFetches = 0;
  const explicitCoverPage = page({
    id: "explicit-cover",
    title: "Explicit Cover",
    slug: "explicit-cover",
    published: true,
  });
  explicitCoverPage.cover = {
    type: "external",
    external: { url: "https://example.com/cover.jpg" },
  };

  const source = createNotionPostSource({
    queryDataSource: async () => ({ results: [explicitCoverPage] }),
    getPageBlocks: async () => {
      blockFetches += 1;
      return [];
    },
  });

  const posts = await source.listPublishedPosts();

  assert.equal(posts[0]?.coverImage, "/api/notion/media/page/explicit-cover/cover");
  assert.equal(blockFetches, 0);
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
  const blockCalls = [];
  const source = createNotionPostSource({
    queryDataSource: async () => ({
      results: [
        page({
          id: "1",
          title: "Public",
          slug: "public",
          published: true,
          updatedAt: "2026-06-09T02:00:00.000Z",
        }),
      ],
    }),
    getPageBlocks: async (pageId, cacheVersion) => {
      blockCalls.push({ pageId, cacheVersion });
      return [
        {
          id: `${pageId}-block`,
          type: "paragraph",
          paragraph: { rich_text: [{ plain_text: "Hello" }] },
        },
      ];
    },
  });

  const post = await source.getPublishedPostBySlug("public");

  assert.equal(post?.title, "Public");
  assert.equal(post?.blocks[0]?.id, "1-block");
  assert.deepEqual(
    Array.from(
      new Set(blockCalls.map((call) => `${call.pageId}:${call.cacheVersion}`))
    ),
    ["1:2026-06-09T02:00:00.000Z"]
  );
});

test("getPublishedPostBySlug returns null when a slug is absent", async () => {
  const source = createNotionPostSource({
    queryDataSource: async () => ({ results: [] }),
    getPageBlocks: async () => [],
  });

  assert.equal(await source.getPublishedPostBySlug("missing"), null);
});
