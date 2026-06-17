// packages/notionx/src/locale-contract/built-in.ts
//
// Default field maps for the four built-in starter models. These names
// are what the scaffolder will provision in Notion and what the
// generated `lib/*/translations.ts` modules read from. Keep the keys
// stable — they are the contract.

import type { LocaleContract } from "./contract";

export const blogBaseFields = {
  title: "Title",
  author: "Author",
  publishedAt: "Published At",
  tags: "Tags",
  cover: "Cover",
  status: "Status",
} as const;

export const blogTranslationFields = {
  source: "Source",
  locale: "Locale",
  slug: "Slug",
  title: "Title",
  description: "Description",
  seoTitle: "SEO Title",
  seoDescription: "SEO Description",
  // Body content is read from the translation page's children blocks,
  // not a Notion property — see createLocalizedGenericNotionContentSource.
  published: "Published",
} as const;

export const pagesBaseFields = {
  title: "Name",
  key: "Key",
  layout: "Layout",
  showHeader: "Show Header",
  showFooter: "Show Footer",
  showInNav: "Show in Nav",
  navOrder: "Nav Order",
  showInFooter: "Show in Footer",
  footerGroup: "Footer Group",
  footerOrder: "Footer Order",
  contentSource: "Content Source",
  blocks: "Blocks",
  cover: "Cover",
} as const;

export const pagesTranslationFields = {
  source: "Source",
  locale: "Locale",
  slug: "Slug",
  title: "Title",
  description: "Description",
  seoTitle: "SEO Title",
  seoDescription: "SEO Description",
  navLabel: "Nav Label",
  footerLabel: "Footer Label",
  // Body content is read from the translation page's children blocks,
  // not a Notion property — see createLocalizedGenericNotionContentSource.
  published: "Published",
} as const;

export const blocksBaseFields = {
  key: "Key",
  type: "Type",
  pageKeys: "Page Keys",
  order: "Order",
  theme: "Theme",
  layout: "Layout",
  cover: "Cover",
} as const;

export const blocksTranslationFields = {
  source: "Source",
  locale: "Locale",
  title: "Title",
  description: "Description",
  eyebrow: "Eyebrow",
  headline: "Headline",
  subheadline: "Subheadline",
  // Body content is read from the translation page's children blocks,
  // not a Notion property — see createLocalizedGenericNotionContentSource.
  quote: "Quote",
  quoteAttribution: "Quote Attribution",
  primaryCtaLabel: "Primary CTA Label",
  primaryCtaHref: "Primary CTA Href",
  secondaryCtaLabel: "Secondary CTA Label",
  secondaryCtaHref: "Secondary CTA Href",
  published: "Published",
} as const;

export const siteSettingsBaseFields = {
  name: "Name",
  section: "Section",
  key: "Key",
  value: "Value",
  type: "Type",
} as const;

export const siteSettingsTranslationFields = {
  source: "Source",
  locale: "Locale",
  value: "Value",
  published: "Published",
} as const;

export const blogContract: LocaleContract = {
  id: "blog",
  baseSourceName: "blog",
  translationSourceName: "blog-translations",
  baseFields: { ...blogBaseFields },
  translationFields: { ...blogTranslationFields },
  fallback: "hide",
  listPath: "/blog",
  detailParam: "slug",
};

export const pagesContract: LocaleContract = {
  id: "pages",
  baseSourceName: "pages",
  translationSourceName: "page-translations",
  baseFields: { ...pagesBaseFields },
  translationFields: { ...pagesTranslationFields },
  fallback: "strict-missing",
  listPath: "/",
  detailParam: "slug",
};

export const blocksContract: LocaleContract = {
  id: "blocks",
  baseSourceName: "blocks",
  translationSourceName: "block-translations",
  baseFields: { ...blocksBaseFields },
  translationFields: { ...blocksTranslationFields },
  fallback: "default-locale",
  listPath: "/",
  detailParam: "slug",
};

export const siteSettingsContract: LocaleContract = {
  id: "site-settings",
  baseSourceName: "site-settings",
  translationSourceName: "site-settings-translations",
  baseFields: { ...siteSettingsBaseFields },
  translationFields: { ...siteSettingsTranslationFields },
  fallback: "default-locale",
  listPath: "/",
  detailParam: "key",
};
