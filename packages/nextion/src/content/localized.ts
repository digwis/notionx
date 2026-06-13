import {
  compactNotionId,
  getCheckboxProperty,
  getRelationPageIds,
  getRichTextProperty,
  getSelectProperty,
  getTagsProperty,
  isRecord,
  isValidPublicSlug,
  notionPageEditUrl,
} from "../notion/property-mappers";
import type { NotionPageLike } from "../notion/types";

export type LocalizedContentFields = {
  title: string;
  source: string;
  locale: string;
  slug: string;
  published: string;
  seoTitle?: string;
  seoDescription?: string;
};

export type LocalizedContentExtraFieldKind =
  | "text"
  | "tags"
  | "select"
  | "checkbox";

export type LocalizedContentExtraFields = Record<
  string,
  string | { field: string; kind?: LocalizedContentExtraFieldKind }
>;

export type LocalizedContentExtraValue = string | string[] | boolean;

export type LocalizedContentTranslationBase = {
  pageId: string;
  updatedAt?: string;
  sourcePageId: string;
  locale: string;
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  editUrl: string | null;
  sourceUrl: string | null;
};

export type LocalizedContentTranslation<TExtra extends object = object> =
  LocalizedContentTranslationBase & TExtra;

function readPublishedFlag(properties: Record<string, unknown>, field: string) {
  const property = properties[field] as Record<string, unknown> | undefined;
  if (property?.type === "checkbox") return getCheckboxProperty(properties, field);

  if (property?.type === "status") {
    const status = property.status as { name?: string } | null | undefined;
    return String(status?.name ?? "").trim().toLowerCase() === "published";
  }

  if (property?.type === "select") {
    const select = property.select as { name?: string } | null | undefined;
    return String(select?.name ?? "").trim().toLowerCase() === "published";
  }

  return false;
}

function readLocale(properties: Record<string, unknown>, field: string) {
  return (
    getSelectProperty(properties, field) || getRichTextProperty(properties, field)
  );
}

function normalizeExtraField(
  definition: string | { field: string; kind?: LocalizedContentExtraFieldKind }
) {
  if (typeof definition === "string") return { field: definition, kind: "text" };
  return { field: definition.field, kind: definition.kind ?? "text" };
}

function readExtraFields<TExtra extends object>(
  properties: Record<string, unknown>,
  fields?: LocalizedContentExtraFields
): TExtra {
  const result: Record<string, LocalizedContentExtraValue> = {};

  for (const [key, definition] of Object.entries(fields ?? {})) {
    const { field, kind } = normalizeExtraField(definition);
    if (kind === "tags") result[key] = getTagsProperty(properties, field);
    else if (kind === "select") result[key] = getSelectProperty(properties, field);
    else if (kind === "checkbox") result[key] = getCheckboxProperty(properties, field);
    else result[key] = getRichTextProperty(properties, field);
  }

  return result as TExtra;
}

export function mapNotionPageToLocalizedContentTranslation<
  TExtra extends object = object,
>(
  page: NotionPageLike,
  input: {
    fields: LocalizedContentFields;
    extraFields?: LocalizedContentExtraFields;
    editBaseUrl?: string;
    isValidLocale?: (locale: string) => boolean;
  }
): LocalizedContentTranslation<TExtra> | null {
  const properties = isRecord(page.properties) ? page.properties : {};
  const sourcePageIds = getRelationPageIds(properties, input.fields.source);
  const locale = readLocale(properties, input.fields.locale);
  const configuredSlug = getRichTextProperty(
    properties,
    input.fields.slug
  ).toLowerCase();
  const slug = isValidPublicSlug(configuredSlug) ? configuredSlug : "";
  const title = getRichTextProperty(properties, input.fields.title);
  const published = readPublishedFlag(properties, input.fields.published);
  const sourceUrl =
    typeof page.public_url === "string" && page.public_url
      ? page.public_url
      : typeof page.url === "string"
        ? page.url
        : null;

  if (
    !sourcePageIds[0] ||
    !locale ||
    !slug ||
    !title ||
    !published ||
    (input.isValidLocale && !input.isValidLocale(locale))
  ) {
    return null;
  }

  return {
    pageId: page.id,
    ...(page.last_edited_time ? { updatedAt: page.last_edited_time } : {}),
    sourcePageId: sourcePageIds[0],
    locale,
    slug,
    title,
    seoTitle: input.fields.seoTitle
      ? getRichTextProperty(properties, input.fields.seoTitle)
      : "",
    seoDescription: input.fields.seoDescription
      ? getRichTextProperty(properties, input.fields.seoDescription)
      : "",
    published,
    editUrl: notionPageEditUrl(page.id, input.editBaseUrl),
    sourceUrl,
    ...readExtraFields<TExtra>(properties, input.extraFields),
  };
}

export function localizeContentList<TBase, TTranslation, TResult>(input: {
  baseItems: readonly TBase[];
  translations: readonly TTranslation[];
  locale: string;
  defaultLocale: string;
  getBasePageId: (item: TBase) => string;
  getTranslationLocale: (translation: TTranslation) => string;
  getTranslationSourcePageId: (translation: TTranslation) => string;
  applyTranslation: (base: TBase, translation: TTranslation) => TResult | null;
  fallback: (base: TBase) => TResult;
  sort?: (left: TResult, right: TResult) => number;
}) {
  const translationsForLocale = input.translations.filter(
    (translation) => input.getTranslationLocale(translation) === input.locale
  );

  if (translationsForLocale.length === 0 && input.locale === input.defaultLocale) {
    const fallback = input.baseItems.map(input.fallback);
    return input.sort ? fallback.sort(input.sort) : fallback;
  }

  const baseByPageId = new Map(
    input.baseItems.map((item) => [compactNotionId(input.getBasePageId(item)), item])
  );
  const localized = translationsForLocale
    .map((translation) => {
      const base = baseByPageId.get(
        compactNotionId(input.getTranslationSourcePageId(translation))
      );
      return base ? input.applyTranslation(base, translation) : null;
    })
    .filter((item): item is TResult => Boolean(item));

  return input.sort ? localized.sort(input.sort) : localized;
}

export function getAlternateLocalizedContentLinks<TTranslation>(input: {
  translations: readonly TTranslation[];
  sourcePageId: string;
  currentLocale: string;
  getTranslationLocale: (translation: TTranslation) => string;
  getTranslationSlug: (translation: TTranslation) => string;
  getTranslationSourcePageId: (translation: TTranslation) => string;
  isValidLocale?: (locale: string) => boolean;
  hrefForTranslation: (locale: string, slug: string) => string;
  labelForLocale?: (locale: string) => string;
}) {
  const normalizedSourcePageId = compactNotionId(input.sourcePageId);

  return input.translations
    .filter((translation) => {
      const locale = input.getTranslationLocale(translation);
      return (
        compactNotionId(input.getTranslationSourcePageId(translation)) ===
          normalizedSourcePageId &&
        locale !== input.currentLocale &&
        (!input.isValidLocale || input.isValidLocale(locale))
      );
    })
    .map((translation) => {
      const locale = input.getTranslationLocale(translation);
      const slug = input.getTranslationSlug(translation);
      return {
        locale,
        slug,
        href: input.hrefForTranslation(locale, slug),
        label: input.labelForLocale?.(locale) ?? locale,
      };
    });
}
