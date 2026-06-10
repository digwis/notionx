import test from "node:test";
import assert from "node:assert/strict";
import { mapNotionPageToMovieTranslation } from "./movie-translations.ts";

test("mapNotionPageToMovieTranslation requires published relation locale and slug", () => {
  const translation = mapNotionPageToMovieTranslation({
    id: "translation-page",
    properties: {
      标题: {
        type: "title",
        title: [{ plain_text: "盗梦空间" }],
      },
      电影: {
        type: "relation",
        relation: [{ id: "movie-page" }],
      },
      语言: {
        type: "select",
        select: { name: "zh-CN" },
      },
      Slug: {
        type: "rich_text",
        rich_text: [{ plain_text: "dao-meng-kong-jian" }],
      },
      导演显示: {
        type: "rich_text",
        rich_text: [{ plain_text: "克里斯托弗·诺兰" }],
      },
      已发布: {
        type: "checkbox",
        checkbox: true,
      },
    },
  });

  assert.deepEqual(translation, {
    pageId: "translation-page",
    moviePageId: "movie-page",
    locale: "zh-CN",
    slug: "dao-meng-kong-jian",
    title: "盗梦空间",
    director: "克里斯托弗·诺兰",
    actors: "",
    summary: "",
    genres: [],
    seoTitle: "",
    seoDescription: "",
    published: true,
    editUrl: "https://www.notion.so/translationpage",
    sourceUrl: null,
  });
});

test("mapNotionPageToMovieTranslation drops unpublished rows", () => {
  const translation = mapNotionPageToMovieTranslation({
    id: "translation-page",
    properties: {
      标题: {
        type: "title",
        title: [{ plain_text: "Draft" }],
      },
      电影: {
        type: "relation",
        relation: [{ id: "movie-page" }],
      },
      语言: {
        type: "select",
        select: { name: "en-US" },
      },
      Slug: {
        type: "rich_text",
        rich_text: [{ plain_text: "draft-movie" }],
      },
      已发布: {
        type: "checkbox",
        checkbox: false,
      },
    },
  });

  assert.equal(translation, null);
});
