import { defineContentModel } from "./model.ts";

export const blogContentModel = defineContentModel({
  id: "blog",
  kind: "article",
  visibility: {
    public: true,
    admin: true,
  },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_DATA_SOURCE_ID",
    defaultDataSourceId: "379dc62d-0738-803c-859a-000bcdfd0dec",
    fields: {
      title: "Title",
      slug: "Slug",
      description: "Description",
      date: "Date",
      author: "Author",
      tags: "Tags",
      status: "Status",
      published: "Published",
      cover: "Cover",
    },
    query: {
      pageSize: 100,
    },
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
    listDescription:
      "关于 vinext、RSC、D1 与 Cloudflare Workers 的笔记。",
    emptyState: "还没有任何文章。",
  },
  capabilities: {
    richBlocks: true,
    coverImages: true,
    gatedAssets: false,
  },
});

export const DEFAULT_NOTION_MOVIE_TRANSLATIONS_DATA_SOURCE_ID =
  "0a98baad-7d0b-451a-ac83-34f7b7c4b53b";

export const movieTranslationsContentModel = defineContentModel({
  id: "movie-translations",
  kind: "directory",
  visibility: {
    public: false,
    admin: false,
  },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_MOVIE_TRANSLATIONS_DATA_SOURCE_ID",
    defaultDataSourceId: DEFAULT_NOTION_MOVIE_TRANSLATIONS_DATA_SOURCE_ID,
    fields: {
      title: "标题",
      movie: "电影",
      locale: "语言",
      slug: "Slug",
      director: "导演显示",
      actors: "演员显示",
      summary: "剧情简介",
      genres: "类型显示",
      seoTitle: "SEO Title",
      seoDescription: "SEO Description",
      published: "已发布",
    },
    query: {
      pageSize: 100,
    },
  },
  routes: {
    listPath: "/movies",
    detailPath: "/movies/[slug]",
    detailParam: "slug",
  },
  ui: {
    name: "电影翻译",
    pluralName: "电影翻译",
    navLabel: "Movie translations",
    listTitle: "电影翻译",
    listDescription: "Notion-backed localized movie copy.",
    emptyState: "还没有已发布的电影翻译。",
  },
  capabilities: {
    richBlocks: false,
    coverImages: false,
    gatedAssets: false,
  },
});

export const movieContentModel = defineContentModel({
  id: "movies",
  kind: "catalog",
  visibility: {
    public: true,
    admin: false,
  },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_MOVIES_DATA_SOURCE_ID",
    defaultDataSourceId: "371dc62d-0738-8015-a601-000bc3944fcb",
    fields: {
      title: "电影名称",
      releaseDate: "上映时间",
      director: "导演",
      actors: "演员",
      summary: "剧情简介",
      genres: "类型",
      cover: ["海报", "封面", "Cover"],
      downloadUrl: "下载链接",
      legacyDownloadUrl: "下载地址",
      extractionCode: "提取码",
    },
    query: {
      pageSize: 100,
      sorts: [{ property: "上映时间", direction: "descending" }],
    },
  },
  routes: {
    listPath: "/movies",
    detailPath: "/movies/[id]",
    detailParam: "id",
    publicApiPath: "/api/movies",
  },
  ui: {
    name: "电影",
    pluralName: "电影",
    navLabel: "Movies",
    listTitle: "电影数据库",
    listDescription:
      "影片资料直接来自 Notion。条目里的海报、剧照、视频和正文块会在详情页按 Notion 内容渲染。",
    emptyState: "还没有可显示的电影条目，或当前环境还没有配置 Notion token。",
  },
  capabilities: {
    richBlocks: true,
    coverImages: true,
    gatedAssets: true,
  },
});

export const contentModels = [
  blogContentModel,
  movieContentModel,
  movieTranslationsContentModel,
] as const;

export type ContentModelId = (typeof contentModels)[number]["id"];

export function getContentModel(id: ContentModelId) {
  return contentModels.find((model) => model.id === id);
}

export function getPublicContentModels() {
  return contentModels.filter((model) => model.visibility.public);
}

export function getAdminContentModels() {
  return contentModels.filter((model) => model.visibility.admin);
}
