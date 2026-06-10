import test from "node:test";
import assert from "node:assert/strict";
import {
  notionMediaR2KeyForUrl,
  publicMediaCacheKeyForUrl,
  publicMediaVariantForAccept,
} from "./cache-keys.ts";

test("publicMediaVariantForAccept selects the best image format", () => {
  assert.equal(publicMediaVariantForAccept("image/avif,image/webp,*/*"), "avif");
  assert.equal(publicMediaVariantForAccept("image/webp,*/*"), "webp");
  assert.equal(publicMediaVariantForAccept("image/png,*/*"), "source");
});

test("publicMediaCacheKeyForUrl includes format variant and sorted query", () => {
  const key = publicMediaCacheKeyForUrl(
    new URL("https://example.com/api/notion/media/page/block?v=1&w=800&q=75"),
    "webp"
  );
  assert.match(key, /__variant=webp/);
  assert.match(key, /q=75/);
  assert.match(key, /v=1/);
  assert.match(key, /w=800/);
});

test("notionMediaR2KeyForUrl builds immutable keys for versioned media", () => {
  const key = notionMediaR2KeyForUrl(
    new URL("https://example.com/api/notion/media/page/block?v=2026-06-09&w=800&q=75"),
    "webp"
  );
  assert.equal(
    key,
    "notion-media/v1/webp/api/notion/media/page/block/v-2026-06-09/w-800/q-75.webp"
  );
});

test("notionMediaR2KeyForUrl skips unversioned or source variants", () => {
  assert.equal(
    notionMediaR2KeyForUrl(
      new URL("https://example.com/api/notion/media/page/block?w=800"),
      "webp"
    ),
    null
  );
  assert.equal(
    notionMediaR2KeyForUrl(
      new URL("https://example.com/api/notion/media/page/block?v=1"),
      "source"
    ),
    null
  );
});
