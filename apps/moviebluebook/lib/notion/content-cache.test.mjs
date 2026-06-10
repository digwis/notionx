import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteNotionContentCache,
  getCachedNotionBlocks,
  notionModelListCacheKey,
  notionPageBlocksCacheKey,
  putCachedNotionBlocks,
} from "./content-cache.ts";

function createMemoryCache() {
  const store = new Map();
  return {
    store,
    cache: {
      kind: "external",
      async get(key) {
        return store.get(key) ?? null;
      },
      async put(key, value) {
        store.set(key, value);
      },
      async delete(key) {
        store.delete(key);
      },
      async list({ prefix = "" } = {}) {
        return {
          keys: Array.from(store.keys())
            .filter((name) => name.startsWith(prefix))
            .map((name) => ({ name })),
          listComplete: true,
        };
      },
    },
  };
}

test("notion content cache uses stable namespaced keys", () => {
  assert.equal(notionModelListCacheKey("blog"), "notion:v2:blog:list");
  assert.equal(
    notionPageBlocksCacheKey("movies", "page-1"),
    "notion:v2:movies:page:page-1:blocks"
  );
  assert.equal(
    notionPageBlocksCacheKey("movies", "page-1", "2026-06-09T01:00:00.000Z"),
    "notion:v2:movies:page:page-1:blocks:v:2026-06-09T01%3A00%3A00.000Z"
  );
});

test("notion block cache reads and writes through the KV adapter", async () => {
  const { cache } = createMemoryCache();
  const blocks = [
    {
      id: "block-1",
      type: "paragraph",
      paragraph: { rich_text: [{ plain_text: "Hello" }] },
    },
  ];

  await putCachedNotionBlocks(cache, {
    modelId: "blog",
    pageId: "page-1",
    blocks,
  });

  assert.deepEqual(
    await getCachedNotionBlocks(cache, { modelId: "blog", pageId: "page-1" }),
    blocks
  );
});

test("notion block cache versions page blocks by Notion last edited time", async () => {
  const { cache } = createMemoryCache();
  const oldBlocks = [{ id: "old", type: "paragraph" }];
  const newBlocks = [{ id: "new", type: "paragraph" }];

  await putCachedNotionBlocks(cache, {
    modelId: "blog",
    pageId: "page-1",
    cacheVersion: "2026-06-09T01:00:00.000Z",
    blocks: oldBlocks,
  });
  await putCachedNotionBlocks(cache, {
    modelId: "blog",
    pageId: "page-1",
    cacheVersion: "2026-06-09T02:00:00.000Z",
    blocks: newBlocks,
  });

  assert.deepEqual(
    await getCachedNotionBlocks(cache, {
      modelId: "blog",
      pageId: "page-1",
      cacheVersion: "2026-06-09T01:00:00.000Z",
    }),
    oldBlocks
  );
  assert.deepEqual(
    await getCachedNotionBlocks(cache, {
      modelId: "blog",
      pageId: "page-1",
      cacheVersion: "2026-06-09T02:00:00.000Z",
    }),
    newBlocks
  );
});

test("deleteNotionContentCache deletes list and page-scoped cache keys", async () => {
  const { cache, store } = createMemoryCache();
  store.set("notion:v2:blog:list", [{ id: "page-1" }]);
  store.set("notion:v2:blog:page:page-1:blocks", [{ id: "block-1" }]);
  store.set("notion:v2:blog:page:page-2:blocks", [{ id: "block-2" }]);

  const result = await deleteNotionContentCache({
    modelId: "blog",
    pageId: "page-1",
    cache,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(
    Array.from(store.keys()).sort(),
    ["notion:v2:blog:page:page-2:blocks"]
  );
});

test("deleteNotionContentCache deletes an entire model when page id is unknown", async () => {
  const { cache, store } = createMemoryCache();
  store.set("notion:v2:blog:list", [{ id: "page-1" }]);
  store.set("notion:v2:blog:page:page-1:blocks", [{ id: "block-1" }]);

  const result = await deleteNotionContentCache({
    modelId: "blog",
    routeId: "post-slug",
    cache,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(store.keys()), []);
});
