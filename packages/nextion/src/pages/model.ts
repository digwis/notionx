import type {
  DefinedSitePageModel,
  SitePageFields,
  SitePageModel,
} from "./types";

export const defaultSitePageFields: SitePageFields = {
  title: "Name",
  key: "Key",
  slug: "Slug",
  status: "Status",
  layout: "Layout",
  description: "Description",
  seoTitle: "SEO Title",
  seoDescription: "SEO Description",
  showHeader: "Show Header",
  showFooter: "Show Footer",
  showInNav: "Show in Nav",
  navLabel: "Nav Label",
  navOrder: "Nav Order",
  showInFooter: "Show in Footer",
  footerLabel: "Footer Label",
  footerGroup: "Footer Group",
  footerOrder: "Footer Order",
  contentSource: "Content Source",
  blocks: "Blocks",
  cover: "Cover",
};

export const defaultPagesDataSourceEnv = "NOTION_PAGES_DATA_SOURCE_ID";

export function defineSitePageModel(model: SitePageModel): DefinedSitePageModel {
  return {
    ...model,
    source: {
      ...model.source,
      fields: {
        ...defaultSitePageFields,
        ...(model.source.fields ?? {}),
      },
      query: {
        pageSize: 100,
        ...(model.source.query ?? {}),
      },
    },
  };
}
