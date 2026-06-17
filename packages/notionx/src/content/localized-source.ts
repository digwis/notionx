// packages/notionx/src/content/localized-source.ts
//
// Locale-aware wrapper around the generic Notion content source.
// Lives in tier 4 (content) so it can import from both notion/ (tier 3)
// and content/localized.ts (same tier).

import { cache } from "react";
import {
  createGenericNotionContentSource,
  type GenericContentListItem,
  type GenericContentDetail,
} from "../notion/generic-source";
import {
  createNotionSourceContext,
  queryAllNotionDataSourcePages,
  type NotionQueryDataSourceFn,
} from "../notion/source-helpers";
import type {
  NotionBlock,
  NotionFieldMap,
  NotionGenericContentModel,
} from "../notion/types";
import {
  localizeContentList,
  mapNotionPageToLocalizedContentTranslation,
  type LocalizedContentFields,
} from "./localized";
import type { LocaleContract } from "../locale-contract/contract";

export type LocalizedGenericContentSourceDeps<
  TFields extends NotionFieldMap = NotionFieldMap,
> = {
  model: NotionGenericContentModel & { source: { fields: TFields } };
  dataSourceId: string;
  queryDataSource: NotionQueryDataSourceFn;
  getPageBlocks: (pageId: string) => Promise<NotionBlock[]>;
  editBaseUrl?: string;
  translationSourceId?: string;
  translationQueryDataSource?: NotionQueryDataSourceFn;
  contract?: LocaleContract;
  defaultLocale?: string;
  supportedLocales?: readonly string[];
  translationFields?: LocalizedContentFields;
};

export function createLocalizedGenericNotionContentSource<
  TFields extends NotionFieldMap,
>(deps: LocalizedGenericContentSourceDeps<TFields>) {
  const baseSource = createGenericNotionContentSource({
    model: deps.model,
    dataSourceId: deps.dataSourceId,
    queryDataSource: deps.queryDataSource,
    getPageBlocks: deps.getPageBlocks,
    ...(deps.editBaseUrl ? { editBaseUrl: deps.editBaseUrl } : {}),
  });

  const hasTranslation =
    Boolean(deps.translationSourceId && deps.translationQueryDataSource);

  async function loadTranslations() {
    if (!hasTranslation || !deps.translationQueryDataSource) return [];
    const pages = await queryAllNotionDataSourcePages(
      deps.translationQueryDataSource
    );
    const fields =
      deps.translationFields ??
      (deps.contract?.translationFields as LocalizedContentFields | undefined);
    if (!fields) return [];
    return pages
      .map((page) =>
        mapNotionPageToLocalizedContentTranslation(page, {
          fields,
          editBaseUrl: deps.editBaseUrl,
          isValidLocale: deps.supportedLocales
            ? (locale: string) =>
                (deps.supportedLocales as readonly string[]).includes(locale)
            : undefined,
        })
      )
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  return {
    async listItems(locale?: string): Promise<GenericContentListItem[]> {
      const baseItems = await baseSource.listItems();

      if (!hasTranslation || !locale || !deps.contract || !deps.defaultLocale) {
        return baseItems;
      }

      const translations = await loadTranslations();
      const contract = deps.contract;
      const defaultLocale = deps.defaultLocale;

      if (contract.fallback === "hide") {
        return localizeContentList({
          baseItems,
          translations,
          locale,
          defaultLocale,
          getBasePageId: (item) => item.pageId,
          getTranslationLocale: (row) => row.locale,
          getTranslationSourcePageId: (row) => row.sourcePageId,
          applyTranslation: (base, translation) => ({
            ...base,
            // Point pageId at the translation page so getItemBySlug
            // fetches the translation's children blocks (body content
            // lives in page blocks, not a rich_text field).
            pageId: translation.pageId,
            editUrl: translation.editUrl,
            title: translation.title,
            slug: translation.slug,
            description: translation.seoDescription || base.description,
          }),
          fallback: (base) => base,
          sort: (a, b) => b.date.localeCompare(a.date),
        });
      }

      const localized = localizeContentList({
        baseItems,
        translations,
        locale,
        defaultLocale,
        getBasePageId: (item) => item.pageId,
        getTranslationLocale: (row) => row.locale,
        getTranslationSourcePageId: (row) => row.sourcePageId,
        applyTranslation: (base, translation) => ({
          ...base,
          // Point pageId at the translation page so getItemBySlug
          // fetches the translation's children blocks (body content
          // lives in page blocks, not a rich_text field).
          pageId: translation.pageId,
          editUrl: translation.editUrl,
          title: translation.title,
          slug: translation.slug,
          description: translation.seoDescription || base.description,
        }),
        fallback: (base) => base,
        sort: (a, b) => b.date.localeCompare(a.date),
      });
      return localized;
    },

    async getItemBySlug(
      slug: string,
      locale?: string
    ): Promise<GenericContentDetail | null> {
      const items = await this.listItems(locale);
      const item = items.find((candidate) => candidate.slug === slug);
      if (!item) return null;
      return {
        ...item,
        blocks: await deps.getPageBlocks(item.pageId),
      };
    },
  };
}

async function createDefaultLocalizedSource<
  TFields extends NotionFieldMap,
>(model: NotionGenericContentModel & { source: { fields: TFields } }) {
  const ctx = await createNotionSourceContext(model);
  if (!ctx) return null;
  const { client, config, editBaseUrl, getPageBlocks } = ctx;

  const translationEnv = (
    model.source as { translationDataSourceEnv?: string }
  ).translationDataSourceEnv;
  const translationDataSourceId = translationEnv
    ? (typeof process !== "undefined" ? process.env?.[translationEnv] : undefined)
    : undefined;

  let contract: LocaleContract | undefined;
  const contractId = (model.source as { contract?: string }).contract;
  if (contractId === "blog") {
    const { blogContract } = await import("../locale-contract/built-in");
    contract = blogContract;
  }

  return createLocalizedGenericNotionContentSource({
    model,
    dataSourceId: config.dataSourceId,
    editBaseUrl,
    queryDataSource: async ({ startCursor } = {}) =>
      client.dataSources.query({
        data_source_id: config.dataSourceId,
        page_size: model.source.query.pageSize,
        sorts: model.source.query.sorts
          ? [...model.source.query.sorts]
          : undefined,
        filter_properties: model.source.query.filterProperties
          ? [...model.source.query.filterProperties]
          : undefined,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    getPageBlocks,
    ...(translationDataSourceId
      ? {
          translationSourceId: translationDataSourceId,
          translationQueryDataSource: async ({ startCursor } = {}) =>
            client.dataSources.query({
              data_source_id: translationDataSourceId,
              page_size: model.source.query.pageSize,
              ...(startCursor ? { start_cursor: startCursor } : {}),
            }),
        }
      : {}),
    ...(contract ? { contract } : {}),
    defaultLocale: (model.source as { defaultLocale?: string }).defaultLocale,
    supportedLocales: (model.source as { supportedLocales?: readonly string[] })
      .supportedLocales,
  });
}

const sourceCache = cache(createDefaultLocalizedSource);

export async function listGenericNotionContentForLocale<
  TFields extends NotionFieldMap,
>(
  model: NotionGenericContentModel & { source: { fields: TFields } },
  locale: string
) {
  const source = await sourceCache(model);
  if (!source) return [];
  return source.listItems(locale);
}

export async function getGenericNotionContentBySlugForLocale<
  TFields extends NotionFieldMap,
>(
  model: NotionGenericContentModel & { source: { fields: TFields } },
  slug: string,
  locale: string
) {
  const source = await sourceCache(model);
  if (!source) return null;
  return source.getItemBySlug(slug, locale);
}
