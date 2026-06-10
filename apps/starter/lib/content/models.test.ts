import test from "node:test";
import assert from "node:assert/strict";
import {
  blogContentModel,
  contentModels,
  getAdminContentModels,
  getContentModel,
  getPublicContentModels,
  movieContentModel,
} from "./models.ts";

test("content registry exposes the built-in models", () => {
  assert.deepEqual(
    contentModels.map((model) => model.id),
    ["blog", "movies", "movie-translations"]
  );
  assert.equal(getContentModel("blog"), blogContentModel);
  assert.equal(getContentModel("movies"), movieContentModel);
});

test("content models define Notion source fields and public routes", () => {
  assert.equal(blogContentModel.source.fields.title, "Title");
  assert.equal(
    blogContentModel.source.defaultDataSourceId,
    "379dc62d-0738-803c-859a-000bcdfd0dec"
  );
  assert.equal(blogContentModel.source.query.filterProperties, undefined);
  assert.equal(blogContentModel.source.query.sorts, undefined);
  assert.equal(blogContentModel.routes.listPath, "/blog");

  assert.equal(movieContentModel.source.fields.title, "电影名称");
  assert.deepEqual(movieContentModel.source.fields.cover, [
    "海报",
    "封面",
    "Cover",
  ]);
  assert.equal(movieContentModel.routes.detailParam, "id");
});

test("registry separates public and admin-enabled content models", () => {
  assert.deepEqual(
    getPublicContentModels().map((model) => model.id),
    ["blog", "movies"]
  );
  assert.deepEqual(
    getAdminContentModels().map((model) => model.id),
    ["blog"]
  );
});
