import { describe, it, expect } from "vitest";
import {
  authorizeContentRevalidate,
  buildContentRevalidationPaths,
  readContentRevalidateRequest,
  readContentRevalidateRequestFromUrl,
} from "../../src/content/revalidate";
import type { ContentModelDefinition } from "../../src/content/models";

function sampleModel(
  id: string,
  overrides: Partial<ContentModelDefinition> = {}
): ContentModelDefinition {
  return {
    id,
    kind: "article",
    visibility: { public: true, admin: false },
    source: {
      type: "notion",
      tokenEnv: "NOTION_TOKEN",
      dataSourceEnv: "NOTION_DS",
      fields: { title: "Title", slug: "Slug" },
      query: { pageSize: 20 },
    },
    routes: {
      listPath: `/${id}`,
      detailPath: `/${id}/[slug]`,
      detailParam: "slug",
    },
    ui: {
      name: id,
      pluralName: id,
      navLabel: id,
      listTitle: id,
      listDescription: "",
      emptyState: "",
    },
    capabilities: { richBlocks: false, coverImages: false, gatedAssets: false },
    ...overrides,
  } as ContentModelDefinition;
}

describe("buildContentRevalidationPaths", () => {
  it("includes list, detail, and public API paths for a typical source", () => {
    const paths = buildContentRevalidationPaths({
      model: sampleModel("blog", {
        routes: {
          listPath: "/blog",
          detailPath: "/blog/[slug]",
          detailParam: "slug",
          publicApiPath: "/api/posts",
        },
      }),
      routeId: "hello-world",
    });
    expect(paths.pagePaths).toEqual(["/blog", "/blog/hello-world"]);
    expect(paths.routePaths).toEqual(["/api/posts", "/api/posts/hello-world"]);
    expect(paths.all).toEqual([
      "/blog",
      "/blog/hello-world",
      "/api/posts",
      "/api/posts/hello-world",
    ]);
  });

  it("expands page paths through a project-supplied callback", () => {
    const paths = buildContentRevalidationPaths({
      model: sampleModel("catalog", {
        routes: {
          listPath: "/catalog",
          detailPath: "/catalog/[id]",
          detailParam: "id",
        },
      }),
      routeId: "inception",
      expandPagePaths: (pagePaths) =>
        pagePaths.flatMap((path) => [`/zh-CN${path}`, `/en-US${path}`]),
    });
    expect(paths.pagePaths).toEqual([
      "/zh-CN/catalog",
      "/en-US/catalog",
      "/zh-CN/catalog/inception",
      "/en-US/catalog/inception",
    ]);
  });

  it("includes project-supplied extra page paths", () => {
    const paths = buildContentRevalidationPaths({
      model: sampleModel("catalog", {
        routes: {
          listPath: "/catalog",
          detailPath: "/catalog/[id]",
          detailParam: "id",
        },
      }),
      routeId: "inception",
      extraPagePaths: ["/catalog/alternate-inception"],
    });
    expect(paths.pagePaths).toEqual([
      "/catalog",
      "/catalog/inception",
      "/catalog/alternate-inception",
    ]);
  });

  it("includes the previous route id when supplied", () => {
    const paths = buildContentRevalidationPaths({
      model: sampleModel("blog", {
        routes: {
          listPath: "/blog",
          detailPath: "/blog/[slug]",
          detailParam: "slug",
        },
      }),
      routeId: "current",
      previousRouteId: "old",
    });
    expect(paths.pagePaths).toEqual([
      "/blog",
      "/blog/current",
      "/blog/old",
    ]);
  });

  it("omits public API paths when includeApi is false", () => {
    const paths = buildContentRevalidationPaths({
      model: sampleModel("blog", {
        routes: {
          listPath: "/blog",
          detailPath: "/blog/[slug]",
          detailParam: "slug",
          publicApiPath: "/api/posts",
        },
      }),
      routeId: "hello",
      includeApi: false,
    });
    expect(paths.routePaths).toEqual([]);
  });
});

describe("authorizeContentRevalidate", () => {
  function requestWithToken(token: string) {
    return new Request("https://example.com/api/content/revalidate", {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("returns false for a missing token", () => {
    const request = new Request("https://example.com/api/content/revalidate");
    expect(authorizeContentRevalidate(request, "secret")).toBe(false);
  });

  it("returns false when the bearer does not match", () => {
    expect(authorizeContentRevalidate(requestWithToken("nope"), "secret")).toBe(
      false
    );
  });

  it("returns true for a matching bearer token", () => {
    expect(
      authorizeContentRevalidate(requestWithToken("secret"), "secret")
    ).toBe(true);
  });

  it("returns false for an empty expected token", () => {
    expect(authorizeContentRevalidate(requestWithToken("anything"), "")).toBe(
      false
    );
    expect(authorizeContentRevalidate(requestWithToken("anything"), null)).toBe(
      false
    );
  });
});

describe("readContentRevalidateRequest", () => {
  it("returns null for an invalid body", async () => {
    const request = new Request("https://example.com/api/content/revalidate", {
      method: "POST",
      body: "not json",
    });
    expect(await readContentRevalidateRequest(request)).toBeNull();
  });

  it("parses a well-formed JSON body", async () => {
    const request = new Request("https://example.com/api/content/revalidate", {
      method: "POST",
      body: JSON.stringify({
        modelId: "blog",
        pageId: "page-1",
        routeId: "hello-world",
        kind: "publish",
      }),
    });
    expect(await readContentRevalidateRequest(request)).toEqual({
      modelId: "blog",
      pageId: "page-1",
      routeId: "hello-world",
      previousRouteId: undefined,
      locale: undefined,
      kind: "publish",
      includeApi: true,
    });
  });
});

describe("readContentRevalidateRequestFromUrl", () => {
  it("returns null when modelId is missing", () => {
    expect(
      readContentRevalidateRequestFromUrl(
        new URL("https://example.com/api/content/revalidate")
      )
    ).toBeNull();
  });

  it("parses query parameters", () => {
    const url = new URL(
      "https://example.com/api/content/revalidate?modelId=blog&pageId=page-1&routeId=post-1&kind=update&includeApi=false"
    );
    expect(readContentRevalidateRequestFromUrl(url)).toEqual({
      modelId: "blog",
      pageId: "page-1",
      routeId: "post-1",
      previousRouteId: undefined,
      locale: undefined,
      kind: "update",
      includeApi: false,
    });
  });
});
