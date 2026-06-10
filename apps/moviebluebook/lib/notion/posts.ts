import { cache } from "react";
import {
  getMissingSearchIndexRouteIds,
  upsertSearchIndexDocument,
} from "../content/search-index.ts";
import { blogContentModel } from "../content/models.ts";
import type {
  KeyValueCacheAdapter,
  SqlDatabaseAdapter,
} from "../platform/runtime.ts";
import { flattenNotionBlockText } from "./block-text.ts";
import { listBlockChildrenDeep, type NotionBlockClient } from "./blocks.ts";
import {
  getCachedNotionBlocks,
  getCachedNotionValue,
  NOTION_LIST_CACHE_TTL_SECONDS,
  notionModelListCacheKey,
  putCachedNotionBlocks,
  putCachedNotionValue,
} from "./content-cache.ts";
import { firstImageUrlFromBlocks } from "./media.ts";
import {
  isRenderablePublishedPost,
  mapNotionPageToListItem,
} from "./mappers.ts";
import type {
  NotionPageLike,
  NotionPostDetail,
  NotionPostListItem,
} from "./types.ts";

type DataSourceQueryResponse = {
  results?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type QueryDataSourceInput = {
  startCursor?: string;
};

export type NotionPostSourceDeps = {
  queryDataSource: (
    input?: QueryDataSourceInput
  ) => Promise<DataSourceQueryResponse>;
  getPageBlocks: (
    pageId: string,
    cacheVersion?: string
  ) => Promise<NotionPostDetail["blocks"]>;
  getSearchIndexDatabase?: () => Promise<SqlDatabaseAdapter | null>;
  getContentCache?: () => Promise<KeyValueCacheAdapter | null>;
  editBaseUrl?: string;
};

export type NotionSearchIndexEnsureResult = {
  total: number;
  indexed: number;
  skipped: boolean;
};

function normalizePage(input: unknown): NotionPageLike | null {
  if (!input || typeof input !== "object") return null;
  const page = input as NotionPageLike;
  return page.id ? page : null;
}

function logNotionPostError(operation: string, error: unknown) {
  const err = error as {
    code?: string;
    status?: number;
    message?: string;
    name?: string;
  };
  console.error(
    JSON.stringify({
      tag: "notion_posts_error",
      operation,
      code: err?.code,
      status: err?.status,
      name: err?.name,
      message: err?.message ?? String(error),
    })
  );
}

function shouldRetryWithoutQueryOptions(error: unknown) {
  const err = error as { code?: string; status?: number };
  return err?.code === "validation_error" || err?.status === 400;
}

export function createNotionPostSource(deps: NotionPostSourceDeps) {
  async function indexPost(post: NotionPostListItem) {
    if (!deps.getSearchIndexDatabase) return;
    const db = await deps.getSearchIndexDatabase();
    if (!db) return;
    const blocks = await deps.getPageBlocks(post.pageId, post.updatedAt);
    await upsertSearchIndexDocument(db, {
      modelId: blogContentModel.id,
      pageId: post.pageId,
      routeId: post.slug,
      title: post.title,
      summary: post.description,
      bodyText: flattenNotionBlockText(blocks),
      facets: [post.author, post.date, ...post.tags],
    });
  }

  return {
    async listPublishedPosts(): Promise<NotionPostListItem[]> {
      const contentCache = deps.getContentCache
        ? await deps.getContentCache()
        : null;
      const listCacheKey = notionModelListCacheKey(blogContentModel.id);
      const cachedPages = await getCachedNotionValue<NotionPageLike[]>(
        contentCache,
        listCacheKey
      );
      if (cachedPages) {
        return this.listPublishedPostsFromPages(cachedPages);
      }

      const pages: NotionPageLike[] = [];
      let cursor: string | undefined;

      do {
        const response = await deps.queryDataSource({ startCursor: cursor });
        for (const item of response.results ?? []) {
          const page = normalizePage(item);
          if (page) pages.push(page);
        }

        cursor = response.next_cursor ?? undefined;
        if (!response.has_more) break;
      } while (cursor);

      await putCachedNotionValue(contentCache, listCacheKey, pages, {
        expirationTtl: NOTION_LIST_CACHE_TTL_SECONDS,
      });
      return this.listPublishedPostsFromPages(pages);
    },

    async listPublishedPostsFromPages(
      pages: readonly NotionPageLike[]
    ): Promise<NotionPostListItem[]> {
      const posts = pages
        .map((page) =>
          mapNotionPageToListItem(page, { editBaseUrl: deps.editBaseUrl })
        )
        .filter(isRenderablePublishedPost)
        .sort((a, b) => b.date.localeCompare(a.date));

      return Promise.all(
        posts.map(async (post) => {
          if (post.coverImage) return post;
          const fallbackCover = firstImageUrlFromBlocks(
            await deps.getPageBlocks(post.pageId, post.updatedAt)
          );
          return fallbackCover ? { ...post, coverImage: fallbackCover } : post;
        })
      );
    },

    async getPublishedPostBySlug(slug: string): Promise<NotionPostDetail | null> {
      const posts = await this.listPublishedPosts();
      const post = posts.find((item) => item.slug === slug);
      if (!post) return null;

      const detail = {
        ...post,
        blocks: await deps.getPageBlocks(post.pageId, post.updatedAt),
      };
      if (deps.getSearchIndexDatabase) {
        const db = await deps.getSearchIndexDatabase();
        if (db) {
          await upsertSearchIndexDocument(db, {
            modelId: blogContentModel.id,
            pageId: detail.pageId,
            routeId: detail.slug,
            title: detail.title,
            summary: detail.description,
            bodyText: flattenNotionBlockText(detail.blocks),
            facets: [detail.author, detail.date, ...detail.tags],
          });
        }
      }
      return detail;
    },

    async ensureSearchIndexForPosts(
      posts: readonly NotionPostListItem[]
    ): Promise<NotionSearchIndexEnsureResult> {
      if (!deps.getSearchIndexDatabase || posts.length === 0) {
        return { total: posts.length, indexed: 0, skipped: true };
      }
      const db = await deps.getSearchIndexDatabase();
      if (!db) {
        return { total: posts.length, indexed: 0, skipped: true };
      }
      const missing = await getMissingSearchIndexRouteIds(db, {
        modelId: blogContentModel.id,
        routeIds: posts.map((post) => post.slug),
      });
      if (missing.length === 0) {
        return { total: posts.length, indexed: 0, skipped: false };
      }

      const missingSet = new Set(missing);
      let indexed = 0;
      for (const post of posts) {
        if (missingSet.has(post.slug)) {
          await indexPost(post);
          indexed += 1;
        }
      }
      return { total: posts.length, indexed, skipped: false };
    },
  };
}

async function createDefaultSource() {
  const [
    { createNotionClient },
    { getNotionConfigForModel, hasNotionModelConfig },
  ] =
    await Promise.all([import("./client.ts"), import("./config.ts")]);
  if (!(await hasNotionModelConfig(blogContentModel))) return null;

  const config = await getNotionConfigForModel(blogContentModel);
  const client = createNotionClient(config);

  return createNotionPostSource({
    editBaseUrl: config.editBaseUrl,
    queryDataSource: async ({ startCursor } = {}) => {
      const baseQuery = {
        data_source_id: config.dataSourceId,
        page_size: blogContentModel.source.query.pageSize,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      };

      try {
        return await client.dataSources.query({
          ...baseQuery,
          sorts: blogContentModel.source.query.sorts
            ? [...blogContentModel.source.query.sorts]
            : undefined,
          filter_properties: blogContentModel.source.query.filterProperties
            ? [...blogContentModel.source.query.filterProperties]
            : undefined,
        });
      } catch (error) {
        if (!shouldRetryWithoutQueryOptions(error)) throw error;
        logNotionPostError("query_with_options", error);
        return client.dataSources.query(baseQuery);
      }
    },
    getPageBlocks: async (pageId, cacheVersion) => {
      const { getRuntimePlatform } = await import("../platform/current.ts");
      const contentCache = getRuntimePlatform().keyValueCache;
      const cachedBlocks = await getCachedNotionBlocks(contentCache, {
        modelId: blogContentModel.id,
        pageId,
        cacheVersion,
      });
      if (cachedBlocks) return cachedBlocks;

      const blocks = await listBlockChildrenDeep(
        client as NotionBlockClient,
        pageId
      );
      await putCachedNotionBlocks(contentCache, {
        modelId: blogContentModel.id,
        pageId,
        cacheVersion,
        blocks,
      });
      return blocks;
    },
    getSearchIndexDatabase: async () => {
      const { getRuntimePlatform } = await import("../platform/current.ts");
      return getRuntimePlatform().database;
    },
    getContentCache: async () => {
      const { getRuntimePlatform } = await import("../platform/current.ts");
      return getRuntimePlatform().keyValueCache;
    },
  });
}

const getDefaultSource = cache(createDefaultSource);

export const getNotionPostsMeta = cache(async () => {
  try {
    const source = await getDefaultSource();
    if (!source) return [];
    return await source.listPublishedPosts();
  } catch (error) {
    logNotionPostError("list", error);
    return [];
  }
});

export const getNotionPostSlugs = cache(async () => {
  try {
    const source = await getDefaultSource();
    if (!source) return [];
    const posts = await source.listPublishedPosts();
    return posts.map((post) => post.slug);
  } catch (error) {
    logNotionPostError("slugs", error);
    return [];
  }
});

export const getNotionPostBySlug = cache(async (slug: string) => {
  try {
    const source = await getDefaultSource();
    if (!source) return null;
    return await source.getPublishedPostBySlug(slug);
  } catch (error) {
    logNotionPostError("detail", error);
    return null;
  }
});

export async function prewarmNotionPostsSearchIndex() {
  try {
    const source = await getDefaultSource();
    if (!source) return { total: 0, indexed: 0, skipped: true };
    return await source.ensureSearchIndexForPosts(await source.listPublishedPosts());
  } catch (error) {
    logNotionPostError("search_index", error);
    throw error;
  }
}

export const ensureNotionPostsSearchIndex = cache(async () => {
  await prewarmNotionPostsSearchIndex();
});
