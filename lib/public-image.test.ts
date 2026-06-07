import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResponsiveImageAttrs,
  getCoverImageLoading,
  isOptimizableCoverImage,
  isPublicImageUrlAllowed,
} from "./public-image.ts";

test("isOptimizableCoverImage returns true for local image proxy URLs", () => {
  assert.equal(
    isOptimizableCoverImage("/api/cdn/uploads/2026-06-06/cover.jpg"),
    true
  );
  assert.equal(
    isOptimizableCoverImage("/api/notion/media/page/page-1/property/%E6%B5%B7%E6%8A%A5"),
    true
  );
});

test("isOptimizableCoverImage returns false for external images", () => {
  assert.equal(
    isOptimizableCoverImage("https://example.com/uploads/2026-06-06/cover.jpg"),
    false
  );
});

test("isPublicImageUrlAllowed accepts stable Notion media proxy URLs", () => {
  assert.equal(
    isPublicImageUrlAllowed("/api/notion/media/page/page-1/cover"),
    true
  );
});

test("isPublicImageUrlAllowed accepts known Notion-hosted media URLs", () => {
  assert.equal(
    isPublicImageUrlAllowed("https://secure.notion-static.com/image.jpg"),
    true
  );
});

test("buildResponsiveImageAttrs builds src and srcSet entries with clamped quality", () => {
  const attrs = buildResponsiveImageAttrs(
    "/api/cdn/uploads/2026-06-06/cover.jpg",
    "(max-width: 640px) 100vw, 50vw",
    { quality: 999 }
  );

  assert.match(attrs.src, /w=1200/);
  assert.match(attrs.src, /q=85/);
  assert.match(attrs.srcSet ?? "", /w=320/);
  assert.match(attrs.srcSet ?? "", /w=640/);
  assert.match(attrs.srcSet ?? "", /1200w/);
  assert.equal(attrs.sizes, "(max-width: 640px) 100vw, 50vw");
});

test("buildResponsiveImageAttrs returns the original src for non-optimizable images", () => {
  const attrs = buildResponsiveImageAttrs("https://example.com/cover.jpg", "100vw");

  assert.equal(attrs.src, "https://example.com/cover.jpg");
  assert.equal(attrs.srcSet, undefined);
});

test("getCoverImageLoading marks above-the-fold cards as eager and high priority", () => {
  assert.deepEqual(getCoverImageLoading(0), {
    loading: "eager",
    fetchPriority: "high",
  });
  assert.deepEqual(getCoverImageLoading(2), {
    loading: "eager",
    fetchPriority: "high",
  });
});

test("getCoverImageLoading keeps later cards lazy", () => {
  assert.deepEqual(getCoverImageLoading(3), {
    loading: "lazy",
    fetchPriority: "auto",
  });
});

test("buildResponsiveImageAttrs uses list variant widths and quality", () => {
  const attrs = buildResponsiveImageAttrs(
    "/api/cdn/uploads/2026-06-06/cover.jpg",
    "(max-width: 640px) 100vw, 50vw",
    { variant: "list" }
  );

  assert.match(attrs.src, /w=640/);
  assert.match(attrs.src, /q=70/);
  assert.match(attrs.srcSet ?? "", /w=320/);
  assert.match(attrs.srcSet ?? "", /w=480/);
  assert.match(attrs.srcSet ?? "", /w=640/);
});

test("buildResponsiveImageAttrs keeps detail variant behavior", () => {
  const attrs = buildResponsiveImageAttrs(
    "/api/cdn/uploads/2026-06-06/cover.jpg",
    "(max-width: 768px) 100vw, 768px",
    { variant: "detail" }
  );

  assert.match(attrs.src, /w=1200/);
  assert.match(attrs.src, /q=85/);
});
