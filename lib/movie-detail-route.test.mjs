import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const detailPagePath = path.join(projectRoot, "app/movies/[id]/page.tsx");
const downloadRoutePath = path.join(
  projectRoot,
  "app/api/movies/[id]/download/route.ts"
);
const moviesApiRoutePath = path.join(projectRoot, "app/api/movies/route.ts");
const movieApiRoutePath = path.join(projectRoot, "app/api/movies/[id]/route.ts");

test("movie detail page keeps public content cacheable", () => {
  const source = fs.readFileSync(detailPagePath, "utf8");

  assert.match(source, /revalidate\s*=\s*300/);
  assert.doesNotMatch(source, /getAuthViewer/);
  assert.doesNotMatch(source, /movie\.downloadUrl/);
  assert.doesNotMatch(source, /movie\.extractionCode/);
  assert.doesNotMatch(source, /getPublicNotionMovieByRouteId/);
  assert.match(source, /getPublicNotionMovieMetaByRouteId/);
  assert.match(source, /MovieBlocksPanel/);
  assert.match(source, /MovieDownloadPanel/);
});

test("movie download API is private and uncached", () => {
  const source = fs.readFileSync(downloadRoutePath, "utf8");

  assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(source, /getAuthViewer/);
  assert.match(source, /Cache-Control", "no-store"/);
});

test("movie list API is public, cacheable, and sanitized", () => {
  const source = fs.readFileSync(moviesApiRoutePath, "utf8");

  assert.match(source, /getPublicNotionMoviesMeta/);
  assert.match(source, /s-maxage=300/);
  assert.doesNotMatch(source, /downloadUrl/);
  assert.doesNotMatch(source, /extractionCode/);
});

test("movie detail API is public, cacheable, and sanitized", () => {
  const source = fs.readFileSync(movieApiRoutePath, "utf8");

  assert.match(source, /getPublicNotionMovieByRouteId/);
  assert.match(source, /s-maxage=300/);
  assert.doesNotMatch(source, /getAuthViewer/);
  assert.doesNotMatch(source, /downloadUrl/);
  assert.doesNotMatch(source, /extractionCode/);
});
