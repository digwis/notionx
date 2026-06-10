import test from "node:test";
import assert from "node:assert/strict";
import {
  expandLocalizedMoviePaths,
  localizedMovieDetailPath,
  localizedMovieListPath,
} from "./config.ts";

test("localized movie paths prefix supported locales", () => {
  assert.equal(localizedMovieListPath("zh-CN"), "/zh-CN/movies");
  assert.equal(localizedMovieDetailPath("en-US", "inception"), "/en-US/movies/inception");
});

test("expandLocalizedMoviePaths duplicates movie routes per locale", () => {
  assert.deepEqual(
    expandLocalizedMoviePaths(["/movies", "/movies/inception"], "zh-CN"),
    ["/zh-CN/movies", "/zh-CN/movies/inception"]
  );

  assert.deepEqual(expandLocalizedMoviePaths(["/blog"]), ["/blog"]);
});
