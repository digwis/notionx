import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeContentRevalidate,
  buildContentRevalidationPaths,
  readContentRevalidateRequest,
  readContentRevalidateRequestFromUrl,
  revalidateContentModel,
} from "./revalidate.ts";
import {
  blogContentModel,
  movieContentModel,
  movieTranslationsContentModel,
} from "./models.ts";

test("authorizeContentRevalidate checks bearer token", () => {
  const request = new Request("https://example.com/api/content/revalidate", {
    headers: { authorization: "Bearer secret-token" },
  });

  assert.equal(authorizeContentRevalidate(request, "secret-token"), true);
  assert.equal(authorizeContentRevalidate(request, "wrong"), false);
  assert.equal(authorizeContentRevalidate(request, ""), false);
});

test("readContentRevalidateRequest parses safe defaults", async () => {
  const request = new Request("https://example.com/api/content/revalidate", {
    method: "POST",
    body: JSON.stringify({
      modelId: "movies",
      pageId: "page-1",
      routeId: "movie-1",
      kind: "publish",
    }),
  });

  assert.deepEqual(await readContentRevalidateRequest(request), {
    modelId: "movies",
    pageId: "page-1",
    routeId: "movie-1",
    previousRouteId: undefined,
    locale: undefined,
    kind: "publish",
    includeApi: true,
  });
});

test("readContentRevalidateRequestFromUrl parses manual GET invalidations", () => {
  assert.deepEqual(
    readContentRevalidateRequestFromUrl(
      new URL(
        "https://example.com/api/content/revalidate?modelId=blog&pageId=page-1&routeId=post-1&kind=update"
      )
    ),
    {
      modelId: "blog",
      pageId: "page-1",
      routeId: "post-1",
      previousRouteId: undefined,
      locale: undefined,
      kind: "update",
      includeApi: true,
    }
  );
});

test("buildContentRevalidationPaths covers list, detail, API, and previous routes", () => {
  assert.deepEqual(
    buildContentRevalidationPaths({
      model: movieContentModel,
      routeId: "movie-1",
      previousRouteId: "old-movie",
    }),
    {
      pagePaths: [
        "/zh-CN/movies",
        "/en-US/movies",
        "/zh-CN/movies/movie-1",
        "/en-US/movies/movie-1",
        "/zh-CN/movies/old-movie",
        "/en-US/movies/old-movie",
      ],
      routePaths: [
        "/api/movies",
        "/api/movies/movie-1",
        "/api/movies/old-movie",
      ],
      all: [
        "/zh-CN/movies",
        "/en-US/movies",
        "/zh-CN/movies/movie-1",
        "/en-US/movies/movie-1",
        "/zh-CN/movies/old-movie",
        "/en-US/movies/old-movie",
        "/api/movies",
        "/api/movies/movie-1",
        "/api/movies/old-movie",
      ],
    }
  );

  assert.deepEqual(
    buildContentRevalidationPaths({
      model: movieTranslationsContentModel,
      routeId: "inception",
      locale: "en-US",
    }),
    {
      pagePaths: ["/en-US/movies", "/en-US/movies/inception"],
      routePaths: [],
      all: ["/en-US/movies", "/en-US/movies/inception"],
    }
  );

  assert.deepEqual(
    buildContentRevalidationPaths({
      model: blogContentModel,
      routeId: "hello-world",
    }),
    {
      pagePaths: ["/blog", "/blog/hello-world"],
      routePaths: ["/api/posts", "/api/posts/hello-world"],
      all: ["/blog", "/blog/hello-world", "/api/posts", "/api/posts/hello-world"],
    }
  );
});

test("revalidateContentModel rejects unauthorized and invalid requests", async () => {
  const revalidated = [];
  const base = {
    revalidatePath(path, type) {
      revalidated.push({ path, type });
    },
  };

  assert.deepEqual(
    await revalidateContentModel({
      ...base,
      request: { modelId: "movies", routeId: "movie-1" },
      tokenAuthorized: false,
    }),
    { ok: false, status: 401, error: "Unauthorized" }
  );
  assert.deepEqual(
    await revalidateContentModel({
      ...base,
      request: { modelId: "", routeId: "summer-soup" },
      tokenAuthorized: true,
    }),
    { ok: false, status: 400, error: "modelId is required" }
  );
  assert.deepEqual(
    await revalidateContentModel({
      ...base,
      request: { modelId: "missing", routeId: "x" },
      tokenAuthorized: true,
    }),
    { ok: false, status: 404, error: "Unknown content model: missing" }
  );
  assert.deepEqual(revalidated, []);
});

test("revalidateContentModel revalidates model paths and clears notion cache", async () => {
  const revalidated = [];
  const contentDeleted = [];
  const result = await revalidateContentModel({
    request: {
      modelId: "movies",
      pageId: "page-1",
      routeId: "movie-1",
      previousRouteId: "old-movie",
      kind: "update",
    },
    tokenAuthorized: true,
    revalidatePath(path, type) {
      revalidated.push({ path, type });
    },
    contentCache: {
      kind: "external",
      async get() {
        return null;
      },
      async put() {},
      async delete(key) {
        contentDeleted.push(key);
      },
      async list({ prefix }) {
        if (prefix === "notion:v2:movies:list") {
          return {
            keys: [{ name: "notion:v2:movies:list" }],
            listComplete: true,
          };
        }
        return {
          keys: [`${prefix}blocks`].map((name) => ({ name })),
          listComplete: true,
        };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.model.id, "movies");
  assert.deepEqual(revalidated, [
    { path: "/zh-CN/movies", type: "page" },
    { path: "/en-US/movies", type: "page" },
    { path: "/zh-CN/movies/movie-1", type: "page" },
    { path: "/en-US/movies/movie-1", type: "page" },
    { path: "/zh-CN/movies/old-movie", type: "page" },
    { path: "/en-US/movies/old-movie", type: "page" },
    { path: "/api/movies", type: undefined },
    { path: "/api/movies/movie-1", type: undefined },
    { path: "/api/movies/old-movie", type: undefined },
  ]);
  assert.deepEqual(contentDeleted, [
    "notion:v2:movies:page:page-1:blocks",
    "notion:v2:movies:list",
  ]);
  assert.equal(result.contentCache.ok, true);
});
