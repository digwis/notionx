import { describe, it, expect, beforeEach } from "vitest";
import {
  clearRegistryForTests,
  defineContentSource,
} from "../../src/content/models";
import {
  getContentModelAdminSummaries,
  summarizeContentModelForAdmin,
} from "../../src/content/admin-summary";

const sampleModel = defineContentSource({
  id: "blog",
  kind: "article",
  visibility: { public: true, admin: true },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_BLOG_DS",
    defaultDataSourceId: "blog-ds-id",
    fields: {
      title: "Title",
      slug: "Slug",
      description: "Description",
      date: "Date",
      cover: "Cover",
    },
    query: { pageSize: 20 },
  },
  routes: {
    listPath: "/blog",
    detailPath: "/blog/[slug]",
    detailParam: "slug",
    publicApiPath: "/api/posts",
  },
  ui: {
    name: "Blog",
    pluralName: "Posts",
    navLabel: "Blog",
    listTitle: "Blog",
    listDescription: "Articles",
    emptyState: "No posts",
  },
  capabilities: { richBlocks: true, coverImages: true, gatedAssets: false },
});

describe("summarizeContentModelForAdmin", () => {
  it("returns the expected shape (id, name, capabilities, etc.)", () => {
    expect(summarizeContentModelForAdmin(sampleModel)).toEqual({
      id: "blog",
      name: "Blog",
      kind: "article",
      visibility: "public+admin",
      listPath: "/blog",
      detailPath: "/blog/[slug]",
      publicApiPath: "/api/posts",
      dataSourceEnv: "NOTION_BLOG_DS",
      hasDefaultDataSource: true,
      fieldCount: 5,
      capabilities: {
        richBlocks: true,
        coverImages: true,
        gatedAssets: false,
      },
    });
  });

  it("does not leak the Notion token env name in the summary", () => {
    const summary = summarizeContentModelForAdmin(sampleModel);
    expect(JSON.stringify(summary)).not.toContain("NOTION_TOKEN");
  });
});

describe("getContentModelAdminSummaries", () => {
  beforeEach(() => {
    clearRegistryForTests();
  });

  it("defaults to reading from the global content source registry", () => {
    const blog = defineContentSource({
      id: "blog",
      kind: "article",
      visibility: { public: true, admin: true },
      source: {
        type: "notion",
        tokenEnv: "NOTION_TOKEN",
        dataSourceEnv: "NOTION_BLOG_DS",
        fields: { title: "Title" },
        query: { pageSize: 20 },
      },
      routes: {
        listPath: "/blog",
        detailPath: "/blog/[slug]",
        detailParam: "slug",
      },
      ui: {
        name: "Blog",
        pluralName: "Posts",
        navLabel: "Blog",
        listTitle: "Blog",
        listDescription: "",
        emptyState: "",
      },
      capabilities: { richBlocks: false, coverImages: false, gatedAssets: false },
    });
    const movies = defineContentSource({
      id: "movies",
      kind: "catalog",
      visibility: { public: true, admin: false },
      source: {
        type: "notion",
        tokenEnv: "NOTION_TOKEN",
        dataSourceEnv: "NOTION_MOVIES_DS",
        fields: { title: "Title" },
        query: { pageSize: 20 },
      },
      routes: {
        listPath: "/movies",
        detailPath: "/movies/[id]",
        detailParam: "id",
      },
      ui: {
        name: "Movies",
        pluralName: "Movies",
        navLabel: "Movies",
        listTitle: "Movies",
        listDescription: "",
        emptyState: "",
      },
      capabilities: { richBlocks: false, coverImages: false, gatedAssets: false },
    });

    const summaries = getContentModelAdminSummaries();
    expect(summaries.map((s) => s.id).sort()).toEqual(["blog", "movies"]);
    expect(summaries.find((s) => s.id === "blog")?.hasDefaultDataSource).toBe(
      false
    );
    expect(blog).toBeDefined();
    expect(movies).toBeDefined();
  });
});
