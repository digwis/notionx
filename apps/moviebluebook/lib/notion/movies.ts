import { cache } from "react";
import {
  getMissingSearchIndexRouteIds,
  upsertSearchIndexDocument,
} from "../content/search-index.ts";
import { movieContentModel } from "../content/models.ts";
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
import { getNotionMovieConfig, hasNotionMovieConfig } from "./config.ts";
import { coverImageUrlForPage } from "./media.ts";
import {
  getDateProperty,
  getRichTextProperty,
  getTagsProperty,
  notionPageEditUrl,
} from "./mappers.ts";
import type {
  NotionMovieDetail,
  NotionMovieDownloadInfo,
  NotionMovieListItem,
  NotionPageLike,
  PublicNotionMovieDetail,
  PublicNotionMovieListItem,
} from "./types.ts";

type DataSourceQueryResponse = {
  results?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type QueryDataSourceInput = {
  startCursor?: string;
};

export type NotionMovieSourceDeps = {
  queryDataSource: (
    input?: QueryDataSourceInput
  ) => Promise<DataSourceQueryResponse>;
  getPageBlocks: (
    pageId: string,
    cacheVersion?: string
  ) => Promise<NotionMovieDetail["blocks"]>;
  getSearchIndexDatabase?: () => Promise<SqlDatabaseAdapter | null>;
  getContentCache?: () => Promise<KeyValueCacheAdapter | null>;
  editBaseUrl?: string;
};

export type NotionSearchIndexEnsureResult = {
  total: number;
  indexed: number;
  skipped: boolean;
};

function logNotionMovieError(operation: string, error: unknown) {
  const err = error as {
    code?: string;
    status?: number;
    message?: string;
    name?: string;
  };
  console.error(
    JSON.stringify({
      tag: "notion_movies_error",
      operation,
      code: err?.code,
      status: err?.status,
      name: err?.name,
      message: err?.message ?? String(error),
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function normalizePage(input: unknown): NotionPageLike | null {
  if (!input || typeof input !== "object") return null;
  const page = input as NotionPageLike;
  return page.id ? page : null;
}

export function compactNotionId(id: string): string {
  return id.replaceAll("-", "").toLowerCase();
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function movieCoverImageUrl(page: NotionPageLike): string | null {
  for (const field of movieContentModel.source.fields.cover) {
    const imageUrl = coverImageUrlForPage(page, field);
    if (imageUrl) return imageUrl;
  }
  return null;
}

export function mapNotionPageToMovieItem(
  page: NotionPageLike,
  options?: { editBaseUrl?: string }
): NotionMovieListItem {
  const fields = movieContentModel.source.fields;
  const properties = isRecord(page.properties) ? page.properties : {};
  const downloadLink = getRichTextProperty(properties, fields.downloadUrl);
  const legacyDownloadText = getRichTextProperty(
    properties,
    fields.legacyDownloadUrl
  );
  const downloadText = downloadLink || legacyDownloadText;
  const downloadUrl = isSafeExternalUrl(downloadText) ? downloadText : null;
  const extractionCode = getRichTextProperty(properties, fields.extractionCode);
  const sourceUrl =
    typeof page.public_url === "string" && page.public_url
      ? page.public_url
      : typeof page.url === "string"
        ? page.url
        : null;

  return {
    pageId: page.id,
    ...(page.last_edited_time ? { updatedAt: page.last_edited_time } : {}),
    routeId: compactNotionId(page.id),
    title: getRichTextProperty(properties, fields.title),
    releaseDate: getDateProperty(properties, fields.releaseDate),
    director: getRichTextProperty(properties, fields.director),
    actors: getRichTextProperty(properties, fields.actors),
    summary: getRichTextProperty(properties, fields.summary),
    genres: getTagsProperty(properties, fields.genres),
    downloadText,
    downloadUrl,
    extractionCode,
    hasDownloadInfo: Boolean(downloadUrl || extractionCode),
    coverImage: movieCoverImageUrl(page),
    editUrl: notionPageEditUrl(page.id, options?.editBaseUrl),
    sourceUrl,
  };
}

export function isRenderableMovie(movie: NotionMovieListItem): boolean {
  return Boolean(movie.title && movie.routeId);
}

export function toPublicMovieDetail(
  movie: NotionMovieDetail
): PublicNotionMovieDetail {
  return {
    ...movie,
    downloadText: "",
    downloadUrl: null,
    extractionCode: "",
  };
}

export function toPublicMovieListItem(
  movie: NotionMovieListItem
): PublicNotionMovieListItem {
  return {
    ...movie,
    downloadText: "",
    downloadUrl: null,
    extractionCode: "",
  };
}

function toMovieDownloadInfo(
  movie: NotionMovieListItem
): NotionMovieDownloadInfo {
  return {
    routeId: movie.routeId,
    title: movie.title,
    downloadUrl: movie.downloadUrl,
    extractionCode: movie.extractionCode,
    hasDownloadInfo: movie.hasDownloadInfo,
  };
}

export function createNotionMovieSource(deps: NotionMovieSourceDeps) {
  async function indexMovie(movie: NotionMovieListItem) {
    if (!deps.getSearchIndexDatabase) return;
    const db = await deps.getSearchIndexDatabase();
    if (!db) return;
    const blocks = await deps.getPageBlocks(movie.pageId, movie.updatedAt);
    await upsertSearchIndexDocument(db, {
      modelId: movieContentModel.id,
      pageId: movie.pageId,
      routeId: movie.routeId,
      title: movie.title,
      summary: movie.summary,
      bodyText: flattenNotionBlockText(blocks),
      facets: [
        movie.releaseDate,
        movie.director,
        movie.actors,
        ...movie.genres,
      ],
    });
  }

  return {
    async listMovies(): Promise<NotionMovieListItem[]> {
      const contentCache = deps.getContentCache
        ? await deps.getContentCache()
        : null;
      const listCacheKey = notionModelListCacheKey(movieContentModel.id);
      const cachedPages = await getCachedNotionValue<NotionPageLike[]>(
        contentCache,
        listCacheKey
      );
      if (cachedPages) {
        return this.listMoviesFromPages(cachedPages);
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
      return this.listMoviesFromPages(pages);
    },

    listMoviesFromPages(pages: readonly NotionPageLike[]) {
      return pages
        .map((page) =>
          mapNotionPageToMovieItem(page, { editBaseUrl: deps.editBaseUrl })
        )
        .filter(isRenderableMovie)
        .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
    },

    async getMovieMetaByRouteId(
      routeId: string
    ): Promise<NotionMovieListItem | null> {
      const normalizedRouteId = compactNotionId(routeId);
      const movies = await this.listMovies();
      return movies.find((item) => item.routeId === normalizedRouteId) ?? null;
    },

    async getMovieByRouteId(routeId: string): Promise<NotionMovieDetail | null> {
      const movie = await this.getMovieMetaByRouteId(routeId);
      if (!movie) return null;

      const detail = {
        ...movie,
        blocks: await deps.getPageBlocks(movie.pageId, movie.updatedAt),
      };
      if (deps.getSearchIndexDatabase) {
        const db = await deps.getSearchIndexDatabase();
        if (db) {
          await upsertSearchIndexDocument(db, {
            modelId: movieContentModel.id,
            pageId: detail.pageId,
            routeId: detail.routeId,
            title: detail.title,
            summary: detail.summary,
            bodyText: flattenNotionBlockText(detail.blocks),
            facets: [
              detail.releaseDate,
              detail.director,
              detail.actors,
              ...detail.genres,
            ],
          });
        }
      }
      return detail;
    },

    async getDownloadInfoByRouteId(
      routeId: string
    ): Promise<NotionMovieDownloadInfo | null> {
      const movie = await this.getMovieMetaByRouteId(routeId);
      return movie ? toMovieDownloadInfo(movie) : null;
    },

    async ensureSearchIndexForMovies(
      movies: readonly NotionMovieListItem[]
    ): Promise<NotionSearchIndexEnsureResult> {
      if (!deps.getSearchIndexDatabase || movies.length === 0) {
        return { total: movies.length, indexed: 0, skipped: true };
      }
      const db = await deps.getSearchIndexDatabase();
      if (!db) {
        return { total: movies.length, indexed: 0, skipped: true };
      }
      const missing = await getMissingSearchIndexRouteIds(db, {
        modelId: movieContentModel.id,
        routeIds: movies.map((movie) => movie.routeId),
      });
      if (missing.length === 0) {
        return { total: movies.length, indexed: 0, skipped: false };
      }

      const missingSet = new Set(missing);
      let indexed = 0;
      for (const movie of movies) {
        if (missingSet.has(movie.routeId)) {
          await indexMovie(movie);
          indexed += 1;
        }
      }
      return { total: movies.length, indexed, skipped: false };
    },
  };
}

async function createDefaultMovieSource() {
  const [{ createNotionClient }] = await Promise.all([import("./client.ts")]);
  if (!(await hasNotionMovieConfig())) return null;

  const config = await getNotionMovieConfig();
  const client = createNotionClient(config);

  return createNotionMovieSource({
    editBaseUrl: config.editBaseUrl,
    queryDataSource: async ({ startCursor } = {}) =>
      client.dataSources.query({
        data_source_id: config.dataSourceId,
        page_size: movieContentModel.source.query.pageSize,
        sorts: movieContentModel.source.query.sorts
          ? [...movieContentModel.source.query.sorts]
          : undefined,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    getPageBlocks: async (pageId, cacheVersion) => {
      const { getRuntimePlatform } = await import("../platform/current.ts");
      const contentCache = getRuntimePlatform().keyValueCache;
      const cachedBlocks = await getCachedNotionBlocks(contentCache, {
        modelId: movieContentModel.id,
        pageId,
        cacheVersion,
      });
      if (cachedBlocks) return cachedBlocks;

      const blocks = await listBlockChildrenDeep(
        client as NotionBlockClient,
        pageId
      );
      await putCachedNotionBlocks(contentCache, {
        modelId: movieContentModel.id,
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

const getDefaultMovieSource = cache(createDefaultMovieSource);

export const getNotionMoviesMeta = cache(async () => {
  try {
    const source = await getDefaultMovieSource();
    if (!source) return [];
    return await source.listMovies();
  } catch (error) {
    logNotionMovieError("list", error);
    return [];
  }
});

export const getPublicNotionMoviesMeta = cache(async () => {
  const movies = await getNotionMoviesMeta();
  return movies.map(toPublicMovieListItem);
});

export const getNotionMovieRouteIds = cache(async () => {
  const movies = await getNotionMoviesMeta();
  return movies.map((movie) => movie.routeId);
});

export const getNotionMovieByRouteId = cache(async (routeId: string) => {
  try {
    const source = await getDefaultMovieSource();
    if (!source) return null;
    return await source.getMovieByRouteId(routeId);
  } catch (error) {
    logNotionMovieError("detail", error);
    return null;
  }
});

export const getPublicNotionMovieMetaByRouteId = cache(
  async (routeId: string) => {
    try {
      const source = await getDefaultMovieSource();
      if (!source) return null;
      const movie = await source.getMovieMetaByRouteId(routeId);
      return movie ? toPublicMovieListItem(movie) : null;
    } catch (error) {
      logNotionMovieError("meta", error);
      return null;
    }
  }
);

export const getPublicNotionMovieByRouteId = cache(async (routeId: string) => {
  const movie = await getNotionMovieByRouteId(routeId);
  return movie ? toPublicMovieDetail(movie) : null;
});

export const getNotionMovieDownloadInfo = cache(
  async (routeId: string): Promise<NotionMovieDownloadInfo | null> => {
    try {
      const source = await getDefaultMovieSource();
      if (!source) return null;
      return await source.getDownloadInfoByRouteId(routeId);
    } catch (error) {
      logNotionMovieError("download", error);
      return null;
    }
  }
);

export async function prewarmNotionMoviesSearchIndex() {
  try {
    const source = await getDefaultMovieSource();
    if (!source) return { total: 0, indexed: 0, skipped: true };
    return await source.ensureSearchIndexForMovies(await source.listMovies());
  } catch (error) {
    logNotionMovieError("search_index", error);
    throw error;
  }
}

export const ensureNotionMoviesSearchIndex = cache(async () => {
  await prewarmNotionMoviesSearchIndex();
});
