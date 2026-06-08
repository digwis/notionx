import test from "node:test";
import assert from "node:assert/strict";
import {
  notionMediaR2KeyForUrl,
  publicCacheKey,
  publicApiCacheKey,
  publicApiCacheKeyForUrl,
  publicCacheKeysForSlug,
  publicMediaCacheKeyForUrl,
  publicMediaVariantForAccept,
  publicMovieCacheKeysForRouteId,
} from "./cache-keys.ts";

test("publicCacheKey normalizes trailing slash", () => {
  assert.equal(
    publicCacheKey("/blog/"),
    "https://cache.local/__public-cache/v20260608c/blog"
  );
  assert.equal(
    publicCacheKey("/blog"),
    "https://cache.local/__public-cache/v20260608c/blog"
  );
});

test("publicCacheKey keeps nested slug paths", () => {
  assert.equal(
    publicCacheKey("/blog/hello-world/"),
    "https://cache.local/__public-cache/v20260608c/blog/hello-world"
  );
});

test("publicCacheKeysForSlug returns list and detail keys", () => {
  const keys = publicCacheKeysForSlug("hello-world");
  assert.deepEqual(keys, [
    "https://cache.local/__public-cache/v20260608c/blog",
    "https://cache.local/__public-cache/v20260608c/blog/hello-world",
  ]);
});

test("publicMovieCacheKeysForRouteId returns movie list and detail keys", () => {
  const keys = publicMovieCacheKeysForRouteId("371dc62d07388025b7ddf33519a7f2f8");
  assert.deepEqual(keys, [
    "https://cache.local/__public-cache/v20260608c/movies",
    "https://cache.local/__public-cache/v20260608c/movies/371dc62d07388025b7ddf33519a7f2f8",
  ]);
});

test("publicApiCacheKey preserves sorted query parameters", () => {
  assert.equal(
    publicApiCacheKey("/api/movies/", "?limit=12&genre=%E5%89%A7%E6%83%85"),
    "https://cache.local/__public-cache/v20260608c/api/movies?genre=%E5%89%A7%E6%83%85&limit=12"
  );
});

test("publicApiCacheKeyForUrl keeps the request origin", () => {
  assert.equal(
    publicApiCacheKeyForUrl(
      new URL("https://example.com/api/movies/?limit=12&genre=drama")
    ),
    "https://example.com/__public-cache/v20260608c/api/movies?genre=drama&limit=12"
  );
});

test("publicMediaVariantForAccept selects the best image format", () => {
  assert.equal(publicMediaVariantForAccept("image/avif,image/webp"), "avif");
  assert.equal(publicMediaVariantForAccept("image/webp,image/*"), "webp");
  assert.equal(publicMediaVariantForAccept("image/png,*/*"), "source");
});

test("publicMediaCacheKeyForUrl includes format variant and sorted query", () => {
  assert.equal(
    publicMediaCacheKeyForUrl(
      new URL(
        "https://moviebluebook.uk/api/notion/media/page/page-1/property/%E6%B5%B7%E6%8A%A5?q=70&w=640&v=2026-06-08"
      ),
      "avif"
    ),
    "https://cache.local/__public-cache/v20260608c/api/notion/media/page/page-1/property/%E6%B5%B7%E6%8A%A5?__variant=avif&q=70&v=2026-06-08&w=640"
  );
});

test("notionMediaR2KeyForUrl builds immutable keys for versioned media", () => {
  assert.equal(
    notionMediaR2KeyForUrl(
      new URL(
        "https://moviebluebook.uk/api/notion/media/page/page-1/property/%E6%B5%B7%E6%8A%A5?v=2026-06-08T03%3A47%3A00.000Z&w=640&q=70"
      ),
      "avif"
    ),
    "notion-media/v1/avif/api/notion/media/page/page-1/property/%25E6%25B5%25B7%25E6%258A%25A5/v-2026-06-08T03%3A47%3A00.000Z/w-640/q-70.avif"
  );
});

test("notionMediaR2KeyForUrl skips unversioned or source variants", () => {
  const url = new URL(
    "https://moviebluebook.uk/api/notion/media/page/page-1/property/Cover?w=640&q=70"
  );

  assert.equal(notionMediaR2KeyForUrl(url, "avif"), null);
  assert.equal(notionMediaR2KeyForUrl(url, "source"), null);
});
