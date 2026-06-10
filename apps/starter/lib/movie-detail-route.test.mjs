import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const detailPagePath = path.join(
  projectRoot,
  "app/[locale]/movies/[slug]/page.tsx"
);
const downloadRoutePath = path.join(
  projectRoot,
  "app/api/movies/[id]/download/route.ts"
);
const moviesApiRoutePath = path.join(projectRoot, "app/api/movies/route.ts");
const movieApiRoutePath = path.join(projectRoot, "app/api/movies/[id]/route.ts");
const publicApiPath = path.join(projectRoot, "lib/public-api.ts");
const movieVideoAccessRoutePath = path.join(
  projectRoot,
  "app/api/movies/[id]/video/[blockId]/route.ts"
);
const movieVideoStreamRoutePath = path.join(
  projectRoot,
  "app/api/movies/[id]/video/[blockId]/stream/route.ts"
);
const authViewerRoutePath = path.join(
  projectRoot,
  "app/api/auth/viewer/route.ts"
);
const notionMediaRoutePath = path.join(
  projectRoot,
  "app/api/notion/media/[...ref]/route.ts"
);
const gatedVideoPath = path.join(projectRoot, "components/GatedVideo.tsx");
const movieDownloadPanelPath = path.join(
  projectRoot,
  "components/MovieDownloadPanel.tsx"
);

test("movie detail page keeps public content cacheable", () => {
  const source = fs.readFileSync(detailPagePath, "utf8");

  assert.match(source, /revalidate\s*=\s*60/);
  assert.doesNotMatch(source, /getAuthViewer/);
  assert.doesNotMatch(source, /movie\.downloadUrl/);
  assert.doesNotMatch(source, /movie\.extractionCode/);
  assert.doesNotMatch(source, /getPublicNotionMovieByRouteId/);
  assert.match(source, /getLocalizedPublicMovieMetaBySlug/);
  assert.match(source, /LocaleSwitcher/);
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
  const publicApi = fs.readFileSync(publicApiPath, "utf8");

  assert.match(source, /getPublicNotionMoviesMeta/);
  assert.match(source, /revalidate\s*=\s*60/);
  assert.match(source, /publicJsonHeadersForListRequest/);
  assert.match(publicApi, /s-maxage=60/);
  assert.doesNotMatch(source, /force-dynamic/);
  assert.doesNotMatch(source, /downloadUrl/);
  assert.doesNotMatch(source, /extractionCode/);
});

test("movie detail API is public, cacheable, and sanitized", () => {
  const source = fs.readFileSync(movieApiRoutePath, "utf8");
  const publicApi = fs.readFileSync(publicApiPath, "utf8");

  assert.match(source, /getPublicNotionMovieByRouteId/);
  assert.match(source, /gatedMediaBlockForApi/);
  assert.match(source, /revalidate\s*=\s*60/);
  assert.match(source, /publicJsonHeaders/);
  assert.match(publicApi, /s-maxage=60/);
  assert.doesNotMatch(source, /force-dynamic/);
  assert.doesNotMatch(source, /getAuthViewer/);
  assert.doesNotMatch(source, /downloadUrl/);
  assert.doesNotMatch(source, /extractionCode/);
});

test("movie video access API is private and quota-aware", () => {
  const source = fs.readFileSync(movieVideoAccessRoutePath, "utf8");

  assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(source, /getAuthViewer/);
  assert.match(source, /unlockMovieVideo/);
  assert.match(source, /createMovieVideoPlaybackToken/);
  assert.match(source, /refreshNotionMovieVideoSource/);
  assert.match(source, /setCachedMovieVideoSource/);
  assert.match(source, /playbackForSource/);
  assert.match(source, /videoEmbedUrl/);
  assert.match(source, /Cache-Control", "no-store"/);
  assert.match(source, /\/stream/);
  assert.match(source, /URLSearchParams\(\{\s*t:\s*token\s*\}\)/);
  assert.match(source, /playback/);
});

test("movie video stream API requires prior access, playback token, and does not cache", () => {
  const source = fs.readFileSync(movieVideoStreamRoutePath, "utf8");

  assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(source, /getAuthViewer/);
  assert.match(source, /canStreamMovieVideo/);
  assert.match(source, /verifyMovieVideoPlaybackToken/);
  assert.match(source, /invalid_token/);
  assert.match(source, /getCachedMovieVideoSource/);
  assert.match(source, /refreshNotionMovieVideoSource/);
  assert.match(source, /setCachedMovieVideoSource/);
  assert.match(source, /Cache-Control", "no-store"/);
  assert.match(source, /Referrer-Policy", "no-referrer"/);
  assert.match(source, /export async function HEAD/);
  assert.match(source, /Range/);
  assert.match(source, /isDirectVideoUrl/);
  assert.doesNotMatch(source, /"content-disposition"/);
});

test("auth viewer API is private and uncached", () => {
  const source = fs.readFileSync(authViewerRoutePath, "utf8");

  assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(source, /getAuthViewer/);
  assert.match(source, /Cache-Control", "no-store"/);
  assert.match(source, /canViewVipContent/);
});

test("movie client panels hydrate admin and VIP copy from private viewer state", () => {
  const gatedVideo = fs.readFileSync(gatedVideoPath, "utf8");
  const downloadPanel = fs.readFileSync(movieDownloadPanelPath, "utf8");

  assert.match(gatedVideo, /useAuthViewer/);
  assert.match(gatedVideo, /管理员账号/);
  assert.match(gatedVideo, /playback\?\.type === "embed"/);
  assert.match(gatedVideo, /controlsList="nodownload"/);
  assert.match(gatedVideo, /playsInline/);
  assert.match(downloadPanel, /useAuthViewer/);
  assert.match(downloadPanel, /管理员账号/);
  assert.match(downloadPanel, /autoLoadedRef/);
});

test("public Notion media API blocks direct video block access", () => {
  const source = fs.readFileSync(notionMediaRoutePath, "utf8");

  assert.match(source, /block\.type\s*===\s*"video"/);
  assert.match(source, /forbidden\(\)/);
});
