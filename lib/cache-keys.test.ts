import test from "node:test";
import assert from "node:assert/strict";
import { publicCacheKey, publicCacheKeysForSlug } from "./cache-keys.ts";

test("publicCacheKey normalizes trailing slash", () => {
  assert.equal(publicCacheKey("/blog/"), "https://cache.local/blog");
  assert.equal(publicCacheKey("/blog"), "https://cache.local/blog");
});

test("publicCacheKey keeps nested slug paths", () => {
  assert.equal(
    publicCacheKey("/blog/hello-world/"),
    "https://cache.local/blog/hello-world"
  );
});

test("publicCacheKeysForSlug returns list and detail keys", () => {
  const keys = publicCacheKeysForSlug("hello-world");
  assert.deepEqual(keys, [
    "https://cache.local/blog",
    "https://cache.local/blog/hello-world",
  ]);
});
