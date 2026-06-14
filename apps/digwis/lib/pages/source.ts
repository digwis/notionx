import type { NotionBlock } from "@notionx/core/notion";
import {
  createSitePagesApi,
  type SitePage,
} from "@notionx/core/pages";
import { contentSources } from "@/lib/content/models";
import { pageFields, pagesDataSourceEnv } from "./model";

const pagesModel = {
  source: {
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: pagesDataSourceEnv,
    fields: pageFields,
  },
};

const fallbackBlocks = (text: string): NotionBlock[] => [
  {
    id: "fallback-intro",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: { content: text },
          plain_text: text,
        },
      ],
    },
  },
];

const fallbackPages: SitePage[] = [
  {
    pageId: "fallback-home",
    key: "home",
    slug: "",
    href: "/",
    title: "digwis",
    description:
      "A Notion-powered site built on @notionx/core, running on Cloudflare Workers with D1, R2, and Cloudflare Images.",
    seoTitle: "digwis",
    seoDescription:
      "A Notion-powered site built on @notionx/core, running on Cloudflare Workers with D1, R2, and Cloudflare Images.",
    layout: "home",
    published: true,
    showHeader: true,
    showFooter: true,
    showInNav: false,
    navLabel: "Home",
    navOrder: 0,
    showInFooter: false,
    footerLabel: "Home",
    footerGroup: "Company",
    footerOrder: 0,
    contentSource: "",
    coverImage: null,
    editUrl: null,
    blocks: fallbackBlocks("Configure Notion Pages to edit this homepage from Notion."),
  },
  {
    pageId: "fallback-blog",
    key: "blog",
    slug: "blog",
    href: "/blog",
    title: "Blog",
    description: "Blog posts backed by Notion metadata and page body content.",
    seoTitle: "Blog",
    seoDescription: "Blog posts backed by Notion metadata and page body content.",
    layout: "content-list",
    published: true,
    showHeader: true,
    showFooter: true,
    showInNav: true,
    navLabel: "Blog",
    navOrder: 30,
    showInFooter: true,
    footerLabel: "Blog",
    footerGroup: "Content",
    footerOrder: 10,
    contentSource: "blog",
    coverImage: null,
    editUrl: null,
    blocks: fallbackBlocks("Latest posts from the default Notion content source."),
  },
];

const pagesApi = createSitePagesApi({
  model: pagesModel,
  fallbackPages,
});

export const listSitePages = pagesApi.listSitePages;
export const getSitePageByKey = pagesApi.getSitePageByKey;
export const getSitePageBySlug = pagesApi.getSitePageBySlug;
export const getSitePageForContentSource = pagesApi.getSitePageForContentSource;
export const getSiteNavigation = pagesApi.getSiteNavigation;
export const getSiteFooterGroups = pagesApi.getSiteFooterGroups;

export type { SitePage, SitePageFooterGroup, SitePageNavItem } from "@notionx/core/pages";

export function findContentSource(id: string) {
  return contentSources.find((source) => source.id === id) ?? null;
}
