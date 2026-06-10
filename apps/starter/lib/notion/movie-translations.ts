import { cache } from "react";
import { movieTranslationsContentModel } from "../content/models.ts";
import type { AppLocale } from "../i18n/config.ts";
import { isAppLocale } from "../i18n/config.ts";
import type { KeyValueCacheAdapter } from "../platform/runtime.ts";
import {
  getCachedNotionValue,
  NOTION_LIST_CACHE_TTL_SECONDS,
  notionModelListCacheKey,
  putCachedNotionValue,
} from "./content-cache.ts";
import { getNotionConfigForModel, hasNotionModelConfig } from "./config.ts";
import {
  getCheckboxProperty,
  getRelationPageIds,
  getRichTextProperty,
  getSelectProperty,
  getTagsProperty,
  isRecord,
  isValidPublicSlug,
  notionPageEditUrl,
} from "./property-mappers.ts";
import type { NotionMovieTranslation, NotionPageLike } from "./types.ts";

type DataSourceQueryResponse = {
  results?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type QueryDataSourceInput = {
  startCursor?: string;
};

export type NotionMovieTranslationSourceDeps = {
  queryDataSource: (
    input?: QueryDataSourceInput
  ) => Promise<DataSourceQueryResponse>;
  getContentCache?: () => Promise<KeyValueCacheAdapter | null>;
  editBaseUrl?: string;
};

function normalizePage(input: unknown): NotionPageLike | null {
  if (!input || typeof input !== "object") return null;
  const page = input as NotionPageLike;
  return page.id ? page : null;
}

export function mapNotionPageToMovieTranslation(
  page: NotionPageLike,
  options?: { editBaseUrl?: string }
): NotionMovieTranslation | null {
  const fields = movieTranslationsContentModel.source.fields;
  const properties = isRecord(page.properties) ? page.properties : {};
  const moviePageIds = getRelationPageIds(properties, fields.movie);
  const locale = getSelectProperty(properties, fields.locale);
  const configuredSlug = getRichTextProperty(properties, fields.slug).toLowerCase();
  const slug = isValidPublicSlug(configuredSlug) ? configuredSlug : "";
  const title = getRichTextProperty(properties, fields.title);
  const published = getCheckboxProperty(properties, fields.published);
  const sourceUrl =
    typeof page.public_url === "string" && page.public_url
      ? page.public_url
      : typeof page.url === "string"
        ? page.url
        : null;

  if (!moviePageIds[0] || !locale || !slug || !title || !published) {
    return null;
  }

  return {
    pageId: page.id,
    ...(page.last_edited_time ? { updatedAt: page.last_edited_time } : {}),
    moviePageId: moviePageIds[0],
    locale,
    slug,
    title,
    director: getRichTextProperty(properties, fields.director),
    actors: getRichTextProperty(properties, fields.actors),
    summary: getRichTextProperty(properties, fields.summary),
    genres: getTagsProperty(properties, fields.genres),
    seoTitle: getRichTextProperty(properties, fields.seoTitle),
    seoDescription: getRichTextProperty(properties, fields.seoDescription),
    published,
    editUrl: notionPageEditUrl(page.id, options?.editBaseUrl),
    sourceUrl,
  };
}

export function createNotionMovieTranslationSource(
  deps: NotionMovieTranslationSourceDeps
) {
  return {
    async listTranslations(): Promise<NotionMovieTranslation[]> {
      const contentCache = deps.getContentCache
        ? await deps.getContentCache()
        : null;
      const listCacheKey = notionModelListCacheKey(
        movieTranslationsContentModel.id
      );
      const cachedPages = await getCachedNotionValue<NotionPageLike[]>(
        contentCache,
        listCacheKey
      );
      if (cachedPages) {
        return this.listTranslationsFromPages(cachedPages);
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
      return this.listTranslationsFromPages(pages);
    },

    listTranslationsFromPages(pages: readonly NotionPageLike[]) {
      return pages
        .map((page) =>
          mapNotionPageToMovieTranslation(page, { editBaseUrl: deps.editBaseUrl })
        )
        .filter((translation): translation is NotionMovieTranslation =>
          Boolean(translation)
        );
    },

    async listPublishedTranslationsForLocale(locale: AppLocale) {
      const translations = await this.listTranslations();
      return translations.filter((translation) => translation.locale === locale);
    },

    async getPublishedTranslationBySlug(locale: AppLocale, slug: string) {
      const normalizedSlug = slug.trim().toLowerCase();
      const translations = await this.listPublishedTranslationsForLocale(locale);
      return (
        translations.find(
          (translation) => translation.slug === normalizedSlug
        ) ?? null
      );
    },
  };
}

async function createDefaultMovieTranslationSource() {
  if (!(await hasNotionModelConfig(movieTranslationsContentModel))) {
    return null;
  }

  const config = await getNotionConfigForModel(movieTranslationsContentModel);
  const { createNotionClient } = await import("./client.ts");
  const client = createNotionClient(config);

  return createNotionMovieTranslationSource({
    editBaseUrl: config.editBaseUrl,
    queryDataSource: async ({ startCursor } = {}) =>
      client.dataSources.query({
        data_source_id: config.dataSourceId,
        page_size: movieTranslationsContentModel.source.query.pageSize,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    getContentCache: async () => {
      const { getRuntimePlatform } = await import("../platform/current.ts");
      return getRuntimePlatform().keyValueCache;
    },
  });
}

const getDefaultMovieTranslationSource = cache(createDefaultMovieTranslationSource);

export const hasMovieTranslationConfig = cache(async () =>
  hasNotionModelConfig(movieTranslationsContentModel)
);

export const getPublishedMovieTranslations = cache(async () => {
  try {
    const source = await getDefaultMovieTranslationSource();
    if (!source) return [];
    return await source.listTranslations();
  } catch (error) {
    console.error(
      JSON.stringify({
        tag: "notion_movie_translations_error",
        operation: "list",
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return [];
  }
});

export const getPublishedMovieTranslationsForLocale = cache(
  async (locale: AppLocale) => {
    if (!isAppLocale(locale)) return [];
    const translations = await getPublishedMovieTranslations();
    return translations.filter((translation) => translation.locale === locale);
  }
);

export const getPublishedMovieTranslationBySlug = cache(
  async (locale: AppLocale, slug: string) => {
    try {
      const source = await getDefaultMovieTranslationSource();
      if (!source) return null;
      return await source.getPublishedTranslationBySlug(locale, slug);
    } catch (error) {
      console.error(
        JSON.stringify({
          tag: "notion_movie_translations_error",
          operation: "detail",
          message: error instanceof Error ? error.message : String(error),
        })
      );
      return null;
    }
  }
);

export const getLocalizedMovieSlugParams = cache(async () => {
  const translations = await getPublishedMovieTranslations();
  return translations
    .filter((translation) => isAppLocale(translation.locale))
    .map((translation) => ({
      locale: translation.locale,
      slug: translation.slug,
    }));
});
