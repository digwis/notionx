import type { NotionBlock } from "../notion/types";

export type SitePageLayout = "home" | "default" | "legal" | "content-list";

export type SitePageFields = {
  title: string;
  key: string;
  slug: string;
  status: string;
  layout: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  showHeader: string;
  showFooter: string;
  showInNav: string;
  navLabel: string;
  navOrder: string;
  showInFooter: string;
  footerLabel: string;
  footerGroup: string;
  footerOrder: string;
  contentSource: string;
  cover: string;
};

export type SitePage = {
  pageId: string;
  key: string;
  slug: string;
  href: string;
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  layout: SitePageLayout;
  published: boolean;
  showHeader: boolean;
  showFooter: boolean;
  showInNav: boolean;
  navLabel: string;
  navOrder: number;
  showInFooter: boolean;
  footerLabel: string;
  footerGroup: string;
  footerOrder: number;
  contentSource: string;
  coverImage: string | null;
  editUrl: string | null;
  blocks: NotionBlock[];
};

export type SitePageNavItem = {
  label: string;
  href: string;
  order: number;
  pageKey: string;
};

export type SitePageFooterGroup = {
  label: string;
  items: SitePageNavItem[];
};

export type SitePageModel = {
  source: {
    tokenEnv: string;
    dataSourceEnv: string;
    defaultDataSourceId?: string;
    fields?: Partial<SitePageFields>;
    query?: {
      pageSize?: number;
    };
  };
};

export type DefinedSitePageModel = SitePageModel & {
  source: Omit<SitePageModel["source"], "fields" | "query"> & {
    fields: SitePageFields;
    query: {
      pageSize: number;
    };
  };
};

export type SitePageSourceDeps = {
  queryDataSource: (input?: { startCursor?: string }) => Promise<{
    results?: unknown[];
    has_more?: boolean;
    next_cursor?: string | null;
  }>;
  getPageBlocks: (pageId: string) => Promise<NotionBlock[]>;
  editBaseUrl?: string;
};
