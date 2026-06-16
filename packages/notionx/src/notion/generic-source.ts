import { cache } from "react";
import { coverImageUrlForPage } from "./media";
import {
  getCheckboxProperty,
  getDateProperty,
  getNumberProperty,
  getRichTextProperty,
  getSelectProperty,
  getTagsProperty,
  isRecord,
  isValidPublicSlug,
  notionPageEditUrl,
  pickDescriptionFallback,
} from "./property-mappers";
import {
  createNotionSourceContext,
  type NotionQueryDataSourceFn,
  queryAllNotionDataSourcePages,
} from "./source-helpers";
import {
  localizeContentList,
  mapNotionPageToLocalizedContentTranslation,
  type LocalizedContentFields,
} from "../content/localized";
import type { LocaleContract } from "../locale-contract/contract";
import type {
  NotionBlock,
  NotionFieldMap,
  NotionGenericContentModel,
  NotionPageLike,
} from "./types";

type PropertyMap = Record<string, unknown>;

export type GenericContentListItem = {
  pageId: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  coverImage: string | null;
  published: boolean;
  editUrl: string | null;
  properties: Record<string, string | string[] | number | boolean>;
};

export type GenericContentDetail = GenericContentListItem & {
  blocks: NotionBlock[];
};

export type GenericContentSourceDeps<
  TFields extends NotionFieldMap = NotionFieldMap,
> = {
  model: NotionGenericContentModel & { source: { fields: TFields } };
  dataSourceId: string;
  queryDataSource: NotionQueryDataSourceFn;
  getPageBlocks: (pageId: string) => Promise<NotionBlock[]>;
  editBaseUrl?: string;
  /**
   * Optional translation data source. When provided, `listItems(locale?)`
   * and `getItemBySlug(slug, locale?)` merge base rows with translation
   * rows for the requested locale according to the contract's fallback
   * rule. When omitted, the source behaves as a single-locale source.
   */
  translationSourceId?: string;
  translationQueryDataSource?: NotionQueryDataSourceFn;
  contract?: LocaleContract;
  defaultLocale?: string;
  supportedLocales?: readonly string[];
  /**
   * Field map for the translation data source. Defaults to the contract's
   * `translationFields` when a contract is provided.
   */
  translationFields?: LocalizedContentFields;
};

function firstFieldName(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getFieldName(fields: NotionFieldMap, key: string) {
  return firstFieldName(fields[key]);
}

function pickPublishedFlagForModel(
  properties: PropertyMap,
  fields: NotionFieldMap
) {
  const publishedField = getFieldName(fields, "published") ?? "Published";
  const published = properties[publishedField] as
    | Record<string, unknown>
    | undefined;
  if (published?.type === "checkbox") return Boolean(published.checkbox);

  const statusField = getFieldName(fields, "status") ?? "Status";
  const status = properties[statusField] as Record<string, unknown> | undefined;
  if (status?.type === "status") {
    const value = status.status as { name?: string } | null | undefined;
    return String(value?.name ?? "").trim().toLowerCase() === "published";
  }
  if (status?.type === "select") {
    const value = status.select as { name?: string } | null | undefined;
    return String(value?.name ?? "").trim().toLowerCase() === "published";
  }

  return true;
}

function coverImageUrlForModel(page: NotionPageLike, fields: NotionFieldMap) {
  const coverField = fields.cover;
  if (Array.isArray(coverField)) {
    for (const field of coverField) {
      const imageUrl = coverImageUrlForPage(page, field);
      if (imageUrl) return imageUrl;
    }
  }
  if (typeof coverField === "string") {
    return coverImageUrlForPage(page, coverField);
  }
  return coverImageUrlForPage(page);
}

function mapExtraProperties(properties: PropertyMap, fields: NotionFieldMap) {
  const result: Record<string, string | string[] | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    const field = firstFieldName(value);
    if (!field) continue;
    const property = properties[field] as Record<string, unknown> | undefined;
    if (!property?.type) {
      result[key] = getRichTextProperty(properties, field);
      continue;
    }

    if (property.type === "multi_select") {
      result[key] = getTagsProperty(properties, field);
      continue;
    }
    if (property.type === "select" || property.type === "status") {
      result[key] = getSelectProperty(properties, field);
      continue;
    }
    if (property.type === "number") {
      result[key] = getNumberProperty(properties, field);
      continue;
    }
    if (property.type === "checkbox") {
      result[key] = getCheckboxProperty(properties, field);
      continue;
    }

    result[key] = getRichTextProperty(properties, field);
  }
  return result;
}

export function mapNotionPageToGenericContentItem<
  TFields extends NotionFieldMap,
>(
  model: { id: string; source: { fields: TFields } },
  page: NotionPageLike,
  options?: { editBaseUrl?: string }
): GenericContentListItem {
  const fields = model.source.fields;
  const properties = isRecord(page.properties) ? page.properties : {};
  const titleField = getFieldName(fields, "title");
  const slugField = getFieldName(fields, "slug");
  const descriptionField = getFieldName(fields, "description");
  const dateField = getFieldName(fields, "date");
  const tagsField = getFieldName(fields, "tags");

  const title = titleField ? getRichTextProperty(properties, titleField) : "";
  const slug = slugField
    ? getRichTextProperty(properties, slugField).toLowerCase()
    : page.id.replaceAll("-", "").toLowerCase();
  const description = pickDescriptionFallback(
    descriptionField ? getRichTextProperty(properties, descriptionField) : "",
    title
  );

  return {
    pageId: page.id,
    slug,
    title,
    description,
    date: dateField ? getDateProperty(properties, dateField) : "",
    tags: tagsField ? getTagsProperty(properties, tagsField) : [],
    coverImage: coverImageUrlForModel(page, fields),
    published: pickPublishedFlagForModel(properties, fields),
    editUrl: notionPageEditUrl(page.id, options?.editBaseUrl),
    properties: mapExtraProperties(properties, fields),
  };
}

export function isRenderableGenericContentItem(item: GenericContentListItem) {
  return Boolean(item.published && item.title && item.slug && isValidPublicSlug(item.slug));
}

export function createGenericNotionContentSource<
  TFields extends NotionFieldMap,
>(deps: GenericContentSourceDeps<TFields>) {
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
      const pages = await queryAllNotionDataSourcePages(deps.queryDataSource);
      const baseItems = pages
        .map((page) =>
          mapNotionPageToGenericContentItem(deps.model, page, {
            editBaseUrl: deps.editBaseUrl,
          })
        )
        .filter(isRenderableGenericContentItem);

      if (!hasTranslation || !locale || !deps.contract || !deps.defaultLocale) {
        return baseItems.sort((a, b) => b.date.localeCompare(a.date));
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
            title: translation.title,
            slug: translation.slug,
            description: translation.seoDescription || base.description,
          }),
          fallback: (base) => base,
          sort: (a, b) => b.date.localeCompare(a.date),
        });
      }

      // default-locale + strict-missing: return base items when no
      // translation matches; the caller decides whether to 404.
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

async function createDefaultGenericSource<
  TFields extends NotionFieldMap,
>(model: NotionGenericContentModel & { source: { fields: TFields } }) {
  const ctx = await createNotionSourceContext(model);
  if (!ctx) return null;
  const { client, config, editBaseUrl, getPageBlocks } = ctx;
  return createGenericNotionContentSource({
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
  });
}

const sourceCache = cache(createDefaultGenericSource);

export async function listGenericNotionContent<
  TFields extends NotionFieldMap,
>(model: NotionGenericContentModel & { source: { fields: TFields } }) {
  const source = await sourceCache(model);
  if (!source) return [];
  return source.listItems();
}

export async function getGenericNotionContentBySlug<
  TFields extends NotionFieldMap,
>(model: NotionGenericContentModel & { source: { fields: TFields } }, slug: string) {
  const source = await sourceCache(model);
  if (!source) return null;
  return source.getItemBySlug(slug);
}
