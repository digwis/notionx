import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");

test("vinext cache adapters are configured for CDN and KV data cache", () => {
  const source = fs.readFileSync(path.join(projectRoot, "vite.config.ts"), "utf8");

  assert.match(source, /cdnAdapter\(/);
  assert.match(source, /kvDataAdapter\(/);
  assert.match(source, /binding:\s*"CONTENT_CACHE"/);
});

test("worker delegates public page caching to vinext", () => {
  const source = fs.readFileSync(path.join(projectRoot, "worker/index.ts"), "utf8");

  assert.match(source, /vinext\/server\/app-router-entry/);
  assert.doesNotMatch(source, /publicCacheKey|publicApiCacheKeyForUrl|getPublicCache/);
});

test("public JSON APIs use ISR revalidate instead of force-dynamic", () => {
  for (const relativePath of [
    "app/api/posts/route.ts",
    "app/api/posts/[slug]/route.ts",
    "app/api/movies/route.ts",
    "app/api/movies/[id]/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
    assert.match(source, /revalidate\s*=\s*60/, relativePath);
    assert.doesNotMatch(source, /force-dynamic/, relativePath);
  }
});

test("wrangler declares canonical SITE_URL", () => {
  const source = fs.readFileSync(path.join(projectRoot, "wrangler.jsonc"), "utf8");
  assert.match(source, /"SITE_URL"/);
});
