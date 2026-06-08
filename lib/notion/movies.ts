import { cache } from "react";
import { listBlockChildrenDeep, type NotionBlockClient } from "./blocks.ts";
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
  getPageBlocks: (pageId: string) => Promise<NotionMovieDetail["blocks"]>;
  editBaseUrl?: string;
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
  return (
    coverImageUrlForPage(page, "海报") ??
    coverImageUrlForPage(page, "封面") ??
    coverImageUrlForPage(page, "Cover")
  );
}

export function mapNotionPageToMovieItem(
  page: NotionPageLike,
  options?: { editBaseUrl?: string }
): NotionMovieListItem {
  const properties = isRecord(page.properties) ? page.properties : {};
  const downloadLink = getRichTextProperty(properties, "下载链接");
  const legacyDownloadText = getRichTextProperty(properties, "下载地址");
  const downloadText = downloadLink || legacyDownloadText;
  const downloadUrl = isSafeExternalUrl(downloadText) ? downloadText : null;
  const extractionCode = getRichTextProperty(properties, "提取码");
  const sourceUrl =
    typeof page.public_url === "string" && page.public_url
      ? page.public_url
      : typeof page.url === "string"
        ? page.url
        : null;

  return {
    pageId: page.id,
    routeId: compactNotionId(page.id),
    title: getRichTextProperty(properties, "电影名称"),
    releaseDate: getDateProperty(properties, "上映时间"),
    director: getRichTextProperty(properties, "导演"),
    actors: getRichTextProperty(properties, "演员"),
    summary: getRichTextProperty(properties, "剧情简介"),
    genres: getTagsProperty(properties, "类型"),
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
  return {
    async listMovies(): Promise<NotionMovieListItem[]> {
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

      return {
        ...movie,
        blocks: await deps.getPageBlocks(movie.pageId),
      };
    },

    async getDownloadInfoByRouteId(
      routeId: string
    ): Promise<NotionMovieDownloadInfo | null> {
      const movie = await this.getMovieMetaByRouteId(routeId);
      return movie ? toMovieDownloadInfo(movie) : null;
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
        page_size: 100,
        sorts: [{ property: "上映时间", direction: "descending" }],
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    getPageBlocks: (pageId) =>
      listBlockChildrenDeep(client as NotionBlockClient, pageId),
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
