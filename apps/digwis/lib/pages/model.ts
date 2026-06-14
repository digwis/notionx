// Notion-backed site pages. Pages are different from article-like
// content sources: they define the site's information architecture,
// navigation/footer visibility, route slugs, SEO copy, and editable
// body blocks for pages such as home, about, blog, and privacy.

import {
  defaultPagesDataSourceEnv,
  defaultSitePageFields,
} from "@notionx/core/pages";

export const pageFields = {
  ...defaultSitePageFields,
} as const;

export const pagesDataSourceEnv = defaultPagesDataSourceEnv;
