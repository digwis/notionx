import test from "node:test";
import assert from "node:assert/strict";
import {
  getContentModelAdminSummaries,
  summarizeContentModelForAdmin,
} from "./admin-summary.ts";
import {
  blogContentModel,
  movieContentModel,
  movieTranslationsContentModel,
  contentModels,
} from "./models.ts";

test("summarizeContentModelForAdmin exposes model metadata without secrets", () => {
  assert.deepEqual(summarizeContentModelForAdmin(blogContentModel), {
    id: "blog",
    name: "Blog",
    kind: "article",
    visibility: "public+admin",
    listPath: "/blog",
    detailPath: "/blog/[slug]",
    publicApiPath: "/api/posts",
    dataSourceEnv: "NOTION_DATA_SOURCE_ID",
    hasDefaultDataSource: true,
    fieldCount: 9,
    capabilities: {
      richBlocks: true,
      coverImages: true,
      gatedAssets: false,
    },
  });
});

test("getContentModelAdminSummaries covers built-in models", () => {
  const summaries = getContentModelAdminSummaries(contentModels);

  assert.deepEqual(
    summaries.map((summary) => summary.id),
    ["blog", "movies", "movie-translations"]
  );
  assert.equal(
    summarizeContentModelForAdmin(movieContentModel).hasDefaultDataSource,
    true
  );
  assert.equal(
    summarizeContentModelForAdmin(movieTranslationsContentModel).dataSourceEnv,
    "NOTION_MOVIE_TRANSLATIONS_DATA_SOURCE_ID"
  );
  assert.equal(JSON.stringify(summaries).includes("NOTION_TOKEN"), false);
});
