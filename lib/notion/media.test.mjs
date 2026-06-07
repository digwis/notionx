import test from "node:test";
import assert from "node:assert/strict";
import {
  coverImageUrlForPage,
  isDirectVideoUrl,
  isNotionHostedFile,
  mediaUrlForBlock,
  normalizeNotionFileSource,
  notionBlockMediaPath,
  notionPageCoverMediaPath,
  notionPagePropertyMediaPath,
  resolveNotionFileUrl,
  videoEmbedUrl,
} from "./media.ts";

test("stable media paths encode the Notion target", () => {
  assert.equal(
    notionPageCoverMediaPath("abc-123"),
    "/api/notion/media/page/abc-123/cover"
  );
  assert.equal(
    notionPagePropertyMediaPath("abc-123", "Cover Image"),
    "/api/notion/media/page/abc-123/property/Cover%20Image"
  );
  assert.equal(notionBlockMediaPath("block-1"), "/api/notion/media/block/block-1");
});

test("normalizeNotionFileSource supports external files", () => {
  assert.deepEqual(
    normalizeNotionFileSource({
      type: "external",
      external: { url: "https://example.com/image.jpg" },
    }),
    { type: "external", url: "https://example.com/image.jpg" }
  );
});

test("normalizeNotionFileSource supports Notion-hosted files", () => {
  const file = {
    type: "file",
    file: {
      url: "https://secure.notion-static.com/signed.jpg",
      expiry_time: "2026-06-07T12:00:00.000Z",
    },
  };

  assert.equal(resolveNotionFileUrl(file), "https://secure.notion-static.com/signed.jpg");
  assert.equal(isNotionHostedFile(file), true);
});

test("coverImageUrlForPage prefers a Cover file property", () => {
  assert.equal(
    coverImageUrlForPage({
      id: "page-1",
      properties: {
        Cover: {
          type: "files",
          files: [
            {
              type: "external",
              external: { url: "https://example.com/property-cover.jpg" },
            },
          ],
        },
      },
      cover: {
        type: "external",
        external: { url: "https://example.com/page-cover.jpg" },
      },
    }),
    "https://example.com/property-cover.jpg"
  );
});

test("coverImageUrlForPage versions Notion-hosted file property covers", () => {
  assert.equal(
    coverImageUrlForPage({
      id: "page-1",
      last_edited_time: "2026-06-08T02:30:00.000Z",
      properties: {
        Cover: {
          type: "files",
          files: [
            {
              type: "file",
              file: {
                url: "https://secure.notion-static.com/signed.jpg",
                expiry_time: "2026-06-08T03:30:00.000Z",
              },
            },
          ],
        },
      },
      cover: null,
    }),
    "/api/notion/media/page/page-1/property/Cover?v=2026-06-08T02%3A30%3A00.000Z"
  );
});

test("mediaUrlForBlock returns stable URLs for Notion-hosted media blocks", () => {
  assert.equal(
    mediaUrlForBlock({
      id: "block-1",
      type: "image",
      image: {
        type: "file",
        file: {
          url: "https://secure.notion-static.com/signed.jpg",
          expiry_time: "2026-06-07T12:00:00.000Z",
        },
      },
    }),
    "/api/notion/media/block/block-1"
  );
});

test("video helpers map common embed URLs", () => {
  assert.equal(
    videoEmbedUrl("https://www.youtube.com/watch?v=abc123"),
    "https://www.youtube.com/embed/abc123"
  );
  assert.equal(
    videoEmbedUrl("https://vimeo.com/123456"),
    "https://player.vimeo.com/video/123456"
  );
  assert.equal(isDirectVideoUrl("https://cdn.example.com/video.mp4"), true);
});
