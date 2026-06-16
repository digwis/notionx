import { cache } from "react";
import { coverImageUrlForPage } from "../notion/media";
import {
  getCheckboxProperty,
  getNumberProperty,
  getRichTextProperty,
  getSelectProperty,
  isRecord,
  notionPageEditUrl,
} from "../notion/property-mappers";
import {
  createNotionSourceContext,
  queryAllNotionDataSourcePages,
} from "../notion/source-helpers";
import type { NotionBlock, NotionPageLike } from "../notion/types";
import { defineSitePageModel } from "./model";
import type {
  SitePage,
  SitePageBlockRef,
  SitePageFields,
  SitePageFooterGroup,
  SitePageModel,
  SitePageNavItem,
  SitePageSourceDeps,
  SitePageLayout,
} from "./types";

export function slugToHref(slug: string) {
  const normalized = slug.trim().replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "/";
}

export function normalizePageSlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
}

function isPublishedStatus(value: string) {
  return value.trim().toLowerCase() === "published";
}

function getCheckboxPropertyWithFallback(
  properties: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  const property = properties[key] as Record<string, unknown> | undefined;
  if (property?.type !== "checkbox") return fallback;
  return getCheckboxProperty(properties, key);
}

function normalizeLayout(value: string): SitePageLayout {
  const normalized = value.trim().toLowerCase();
  if (normalized === "home") return "home";
  if (normalized === "legal") return "legal";
  if (normalized === "content-list") return "content-list";
  return "default";
}

function parseStructuredBlockRefs(raw: string): SitePageBlockRef[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): SitePageBlockRef | null => {
        if (typeof item === "string") {
          const slug = normalizePageSlug(item);
          return slug ? { slug, order: index } : null;
        }
        if (!isRecord(item) || typeof item.slug !== "string") return null;

        const slug = normalizePageSlug(item.slug);
        if (!slug) return null;

        return {
          slug,
          variant:
            typeof item.variant === "string" && item.variant.trim()
              ? item.variant.trim()
              : undefined,
          order:
            typeof item.order === "number" && Number.isFinite(item.order)
              ? item.order
              : index,
        };
      })
      .filter((item): item is SitePageBlockRef => Boolean(item))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch {
    return [];
  }
}

export function mapNotionPageToSitePage(
  page: NotionPageLike,
  fields: SitePageFields,
  blocks: NotionBlock[] = [],
  options?: { editBaseUrl?: string }
): SitePage | null {
  const properties = isRecord(page.properties) ? page.properties : {};
  const title = getRichTextProperty(properties, fields.title);
  const key = getRichTextProperty(properties, fields.key).toLowerCase();
  const slug = normalizePageSlug(getRichTextProperty(properties, fields.slug));
  const status = getSelectProperty(properties, fields.status);
  if (!title || !key || !isPublishedStatus(status)) return null;

  const description = getRichTextProperty(properties, fields.description);
  const seoTitle = getRichTextProperty(properties, fields.seoTitle) || title;
  const seoDescription =
    getRichTextProperty(properties, fields.seoDescription) || description;
  const navLabel = getRichTextProperty(properties, fields.navLabel) || title;
  const footerLabel =
    getRichTextProperty(properties, fields.footerLabel) || navLabel;

  return {
    pageId: page.id,
    key,
    slug,
    href: slugToHref(slug),
    title,
    description,
    seoTitle,
    seoDescription,
    layout: normalizeLayout(getSelectProperty(properties, fields.layout)),
    published: true,
    showHeader: getCheckboxPropertyWithFallback(
      properties,
      fields.showHeader,
      true
    ),
    showFooter: getCheckboxPropertyWithFallback(
      properties,
      fields.showFooter,
      true
    ),
    showInNav: getCheckboxProperty(properties, fields.showInNav),
    navLabel,
    navOrder: getNumberProperty(properties, fields.navOrder, 100),
    showInFooter: getCheckboxProperty(properties, fields.showInFooter),
    footerLabel,
    footerGroup: getSelectProperty(properties, fields.footerGroup) || "Company",
    footerOrder: getNumberProperty(properties, fields.footerOrder, 100),
    contentSource: getRichTextProperty(properties, fields.contentSource),
    coverImage: coverImageUrlForPage(page, fields.cover),
    editUrl: notionPageEditUrl(page.id, options?.editBaseUrl),
    structuredBlocks: parseStructuredBlockRefs(
      getRichTextProperty(properties, fields.blocks)
    ),
    blocks,
  };
}

export function createSitePageSource(
  modelInput: SitePageModel,
  deps: SitePageSourceDeps
) {
  const model = defineSitePageModel(modelInput);
  const fields = model.source.fields;

  return {
    async listPages(): Promise<SitePage[]> {
      const pages = await queryAllNotionDataSourcePages(deps.queryDataSource);
      const result: SitePage[] = [];
      for (const page of pages) {
        const mapped = mapNotionPageToSitePage(
          page,
          fields,
          await deps.getPageBlocks(page.id),
          { editBaseUrl: deps.editBaseUrl }
        );
        if (mapped) result.push(mapped);
      }

      return result.sort((a, b) => a.navOrder - b.navOrder || a.title.localeCompare(b.title));
    },
  };
}

async function createDefaultSitePageSource(modelInput: SitePageModel) {
  const model = defineSitePageModel(modelInput);
  const ctx = await createNotionSourceContext(model);
  if (!ctx) return null;

  const { client, config, editBaseUrl, getPageBlocks } = ctx;
  return createSitePageSource(model, {
    editBaseUrl,
    queryDataSource: async ({ startCursor } = {}) =>
      client.dataSources.query({
        data_source_id: config.dataSourceId,
        page_size: model.source.query.pageSize,
        sorts: [{ property: model.source.fields.navOrder, direction: "ascending" }],
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    getPageBlocks,
  });
}

const defaultSourceCache = cache(createDefaultSitePageSource);

export function createSitePagesApi(input: {
  model: SitePageModel;
  fallbackPages?: readonly SitePage[];
}) {
  const fallbackPages = [...(input.fallbackPages ?? [])];

  const listSitePages = cache(async (): Promise<SitePage[]> => {
    try {
      const source = await defaultSourceCache(input.model);
      const pages = source ? await source.listPages() : [];
      return pages.length ? pages : fallbackPages;
    } catch {
      return fallbackPages;
    }
  });

  return {
    listSitePages,
    async getSitePageByKey(key: string) {
      const pages = await listSitePages();
      return pages.find((page) => page.key === key.toLowerCase()) ?? null;
    },
    async getSitePageBySlug(slug: string) {
      const normalized = normalizePageSlug(slug);
      const pages = await listSitePages();
      return pages.find((page) => page.slug === normalized) ?? null;
    },
    async getSitePageForContentSource(sourceId: string) {
      const pages = await listSitePages();
      return (
        pages.find(
          (page) =>
            page.layout === "content-list" && page.contentSource === sourceId
        ) ?? null
      );
    },
    async getSiteNavigation(): Promise<SitePageNavItem[]> {
      const pages = await listSitePages();
      return deriveSiteNavigation(pages);
    },
    async getSiteFooterGroups(): Promise<SitePageFooterGroup[]> {
      const pages = await listSitePages();
      return deriveSiteFooterGroups(pages);
    },
  };
}

export function deriveSiteNavigation(
  pages: readonly SitePage[]
): SitePageNavItem[] {
  return pages
    .filter((page) => page.showInNav)
    .map((page) => ({
      label: page.navLabel,
      href: page.href,
      order: page.navOrder,
      pageKey: page.key,
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export function deriveSiteFooterGroups(
  pages: readonly SitePage[]
): SitePageFooterGroup[] {
  const groups = new Map<string, SitePageNavItem[]>();

  for (const page of pages.filter((candidate) => candidate.showInFooter)) {
    const label = page.footerGroup || "Company";
    const items = groups.get(label) ?? [];
    items.push({
      label: page.footerLabel,
      href: page.href,
      order: page.footerOrder,
      pageKey: page.key,
    });
    groups.set(label, items);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items: items.sort(
      (a, b) => a.order - b.order || a.label.localeCompare(b.label)
    ),
  }));
}
