import { describe, it, expect } from "vitest";
import {
  notionMediaR2KeyForUrl,
  publicMediaCacheKeyForUrl,
  publicMediaVariantForAccept,
} from "../../src/cache/cache-keys";

describe("cache-keys", () => {
  it("selects the best image format from the Accept header", () => {
    expect(publicMediaVariantForAccept("image/avif,image/webp,*/*")).toBe("avif");
    expect(publicMediaVariantForAccept("image/webp,*/*")).toBe("webp");
    expect(publicMediaVariantForAccept("image/png,*/*")).toBe("source");
  });

  it("builds a CDN cache key that includes the variant and sorted query", () => {
    const key = publicMediaCacheKeyForUrl(
      new URL("https://example.com/api/notion/media/page/block?v=1&w=800&q=75"),
      "webp"
    );
    expect(key).toMatch(/__variant=webp/);
    expect(key).toMatch(/q=75/);
    expect(key).toMatch(/v=1/);
    expect(key).toMatch(/w=800/);
  });

  it("builds a stable R2 object key for versioned media variants", () => {
    const key = notionMediaR2KeyForUrl(
      new URL("https://example.com/api/notion/media/page/block?v=2026-06-09&w=800&q=75"),
      "webp"
    );
    expect(key).toBe(
      "notion-media/v1/webp/api/notion/media/page/block/v-2026-06-09/w-800/q-75.webp"
    );
  });

  it("skips R2 keys when the media is not versioned or the variant is the source", () => {
    expect(
      notionMediaR2KeyForUrl(
        new URL("https://example.com/api/notion/media/page/block?w=800"),
        "webp"
      )
    ).toBeNull();
    expect(
      notionMediaR2KeyForUrl(
        new URL("https://example.com/api/notion/media/page/block?v=1"),
        "source"
      )
    ).toBeNull();
  });
});
