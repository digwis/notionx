import test from "node:test";
import assert from "node:assert/strict";
import {
  createCloudflareKeyValueCacheAdapter,
  createCloudflarePublicCacheAdapter,
  createCloudflareRuntimePlatform,
  createNoopKeyValueCacheAdapter,
  createNoopPublicCacheAdapter,
} from "./runtime.ts";

function streamFromText(text) {
  return new Blob([text]).stream();
}

test("createCloudflareRuntimePlatform exposes R2 object storage", async () => {
  const puts = [];
  const deletes = [];
  const env = {
    ASSETS_BUCKET: {
      async get(key) {
        assert.equal(key, "uploads/file.txt");
        return {
          body: streamFromText("hello"),
          size: 5,
          etag: "etag-1",
          httpMetadata: { contentType: "text/plain" },
        };
      },
      async put(key, value, options) {
        puts.push({ key, value, options });
      },
      async delete(key) {
        deletes.push(key);
      },
      async list(options) {
        assert.deepEqual(options, { prefix: "uploads", limit: 10 });
        return {
          objects: [
            {
              key: "uploads/file.txt",
              size: 5,
              uploaded: new Date("2026-06-08T00:00:00.000Z"),
            },
          ],
        };
      },
    },
  };

  const platform = createCloudflareRuntimePlatform(env);
  assert.equal(platform.id, "cloudflare-workers");
  assert.equal(platform.objectStorage?.kind, "r2");

  const object = await platform.objectStorage.get("uploads/file.txt");
  assert.equal(object.size, 5);
  assert.equal(object.etag, "etag-1");
  assert.equal(object.contentType, "text/plain");

  await platform.objectStorage.put("uploads/new.txt", "hello", {
    contentType: "text/plain",
    cacheControl: "public",
    metadata: { source: "test" },
  });
  assert.equal(puts[0].key, "uploads/new.txt");
  assert.deepEqual(puts[0].options, {
    httpMetadata: {
      contentType: "text/plain",
      cacheControl: "public",
    },
    customMetadata: { source: "test" },
  });

  assert.deepEqual(await platform.objectStorage.list({ prefix: "uploads", limit: 10 }), [
    {
      key: "uploads/file.txt",
      size: 5,
      uploaded: new Date("2026-06-08T00:00:00.000Z"),
    },
  ]);

  await platform.objectStorage.delete("uploads/file.txt");
  assert.deepEqual(deletes, ["uploads/file.txt"]);
});

test("createCloudflareRuntimePlatform exposes D1-style SQL database", async () => {
  const prepared = [];
  const batched = [];
  const env = {
    DB: {
      prepare(query) {
        const state = { query, values: [] };
        const statement = {
          bind(...values) {
            state.values = values;
            return statement;
          },
          async all() {
            return {
              results: [{ id: 1, email: "a@example.com" }],
              success: true,
              meta: { rows_read: 1 },
            };
          },
          async first() {
            return { id: 1, email: "a@example.com" };
          },
          async run() {
            return {
              success: true,
              meta: { changes: 1, last_row_id: 9 },
            };
          },
        };
        prepared.push({ state, statement });
        return statement;
      },
      async batch(statements) {
        batched.push(statements);
        return [{ success: true, meta: { changes: 2 } }];
      },
    },
  };

  const platform = createCloudflareRuntimePlatform(env);
  assert.equal(platform.database?.kind, "d1");

  const statement = platform.database
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(1);
  assert.deepEqual(prepared[0].state, {
    query: "SELECT * FROM users WHERE id = ?",
    values: [1],
  });
  assert.deepEqual(await statement.all(), {
    results: [{ id: 1, email: "a@example.com" }],
    success: true,
    meta: { rows_read: 1 },
  });
  assert.deepEqual(await statement.first(), {
    id: 1,
    email: "a@example.com",
  });
  assert.deepEqual(await statement.run(), {
    success: true,
    meta: { changes: 1, last_row_id: 9 },
  });

  const result = await platform.database.batch([statement]);
  assert.equal(batched[0][0], statement);
  assert.deepEqual(result, [{ success: true, meta: { changes: 2 } }]);
});

test("createCloudflareRuntimePlatform exposes Cloudflare Images transform", async () => {
  const env = {
    IMAGES: {
      input(body) {
        assert.ok(body);
        return {
          transform(options) {
            assert.deepEqual(options, { width: 640 });
            return {
              async output(options) {
                assert.deepEqual(options, {
                  format: "image/webp",
                  quality: 75,
                });
                return {
                  image() {
                    return streamFromText("image");
                  },
                  contentType() {
                    return "image/webp";
                  },
                  response() {
                    return new Response(streamFromText("image"), {
                      headers: { "Content-Type": "image/webp" },
                    });
                  },
                };
              },
            };
          },
        };
      },
    },
  };

  const platform = createCloudflareRuntimePlatform(env);
  assert.equal(platform.imageTransformer?.kind, "cloudflare-images");

  const result = await platform.imageTransformer.transform(streamFromText("raw"), {
    width: 640,
    format: "image/webp",
    quality: 75,
  });
  assert.equal(result.contentType, "image/webp");
  assert.equal(result.response().headers.get("Content-Type"), "image/webp");
});

test("createCloudflarePublicCacheAdapter wraps standard cache keys", async () => {
  const calls = [];
  const stored = new Map();
  const backingCache = {
    async match(request) {
      calls.push({ op: "match", url: request.url, method: request.method });
      return stored.get(request.url);
    },
    async put(request, response) {
      calls.push({ op: "put", url: request.url, method: request.method });
      stored.set(request.url, response);
    },
    async delete(request) {
      calls.push({ op: "delete", url: request.url, method: request.method });
      return stored.delete(request.url);
    },
  };

  const cache = createCloudflarePublicCacheAdapter(backingCache);
  const key = "https://cache.local/__public-cache/v20260608d/blog";

  assert.equal(cache.kind, "cloudflare-cache");
  assert.equal(await cache.match(key), null);

  const response = new Response("hello", {
    headers: { "Content-Type": "text/plain" },
  });
  await cache.put(key, response);

  const cached = await cache.match(key);
  assert.equal(await cached.text(), "hello");
  assert.equal(await cache.delete(key), true);
  assert.equal(await cache.match(key), null);
  assert.deepEqual(calls, [
    { op: "match", url: key, method: "GET" },
    { op: "put", url: key, method: "GET" },
    { op: "match", url: key, method: "GET" },
    { op: "delete", url: key, method: "GET" },
    { op: "match", url: key, method: "GET" },
  ]);
});

test("createNoopPublicCacheAdapter provides an explicit cache miss adapter", async () => {
  const cache = createNoopPublicCacheAdapter();
  assert.equal(cache.kind, "noop");
  assert.equal(await cache.match("https://cache.local/x"), null);
  await cache.put("https://cache.local/x", new Response("hello"));
  assert.equal(await cache.delete("https://cache.local/x"), false);
});

test("createCloudflareRuntimePlatform exposes optional public cache adapter", async () => {
  const platform = createCloudflareRuntimePlatform(
    {},
    {
      publicCache: {
        async match() {
          return new Response("cached");
        },
        async put() {},
        async delete() {
          return true;
        },
      },
    }
  );

  assert.equal(platform.publicCache?.kind, "cloudflare-cache");
  assert.equal(await (await platform.publicCache.match("https://cache.local/x")).text(), "cached");
});

test("createCloudflareKeyValueCacheAdapter wraps JSON KV operations", async () => {
  const calls = [];
  const store = new Map();
  const namespace = {
    async get(key, options) {
      calls.push({ op: "get", key, options });
      return store.has(key) ? JSON.parse(store.get(key)) : null;
    },
    async put(key, value, options) {
      calls.push({ op: "put", key, value, options });
      store.set(key, value);
    },
    async delete(key) {
      calls.push({ op: "delete", key });
      store.delete(key);
    },
    async list(options) {
      calls.push({ op: "list", options });
      return {
        keys: Array.from(store.keys())
          .filter((name) => name.startsWith(options.prefix))
          .map((name) => ({ name })),
        list_complete: true,
      };
    },
  };

  const cache = createCloudflareKeyValueCacheAdapter(namespace);
  await cache.put("notion:v2:blog:list", [{ id: "page-1" }], {
    expirationTtl: 60,
    metadata: { source: "test" },
  });

  assert.deepEqual(await cache.get("notion:v2:blog:list", { cacheTtl: 300 }), [
    { id: "page-1" },
  ]);
  assert.deepEqual(await cache.list({ prefix: "notion:v2:blog:" }), {
    keys: [{ name: "notion:v2:blog:list" }],
    cursor: undefined,
    listComplete: true,
  });
  await cache.delete("notion:v2:blog:list");
  assert.equal(await cache.get("notion:v2:blog:list"), null);
  assert.equal(calls[0].op, "put");
  assert.equal(calls[1].options.cacheTtl, 300);
});

test("createCloudflareRuntimePlatform exposes optional KV content cache", async () => {
  const platform = createCloudflareRuntimePlatform({
    CONTENT_CACHE: {
      async get() {
        return { ok: true };
      },
      async put() {},
      async delete() {},
      async list() {
        return { keys: [], list_complete: true };
      },
    },
  });

  assert.equal(platform.keyValueCache?.kind, "workers-kv");
  assert.deepEqual(await platform.keyValueCache.get("x"), { ok: true });
});

test("createNoopKeyValueCacheAdapter provides an explicit KV miss adapter", async () => {
  const cache = createNoopKeyValueCacheAdapter();
  assert.equal(cache.kind, "noop");
  assert.equal(await cache.get("x"), null);
  await cache.put("x", { ok: true });
  await cache.delete("x");
  assert.deepEqual(await cache.list({ prefix: "x" }), {
    keys: [],
    listComplete: true,
  });
});
