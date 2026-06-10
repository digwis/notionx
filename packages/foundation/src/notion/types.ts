export type NotionFileSource =
  | {
      type: "external";
      url: string;
    }
  | {
      type: "file";
      url: string;
      expiryTime: string | null;
    };

export type NotionPostListItem = {
  pageId: string;
  updatedAt?: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  coverImage: string | null;
  published: boolean;
  editUrl: string | null;
};

export type NotionPostDetail = NotionPostListItem & {
  blocks: NotionBlock[];
};

export type NotionMovieListItem = {
  pageId: string;
  updatedAt?: string;
  routeId: string;
  title: string;
  releaseDate: string;
  director: string;
  actors: string;
  summary: string;
  genres: string[];
  downloadText: string;
  downloadUrl: string | null;
  extractionCode: string;
  hasDownloadInfo: boolean;
  coverImage: string | null;
  editUrl: string | null;
  sourceUrl: string | null;
};

export type PublicNotionMovieListItem = Omit<
  NotionMovieListItem,
  "downloadText" | "downloadUrl" | "extractionCode"
> & {
  downloadText: "";
  downloadUrl: null;
  extractionCode: "";
};

export type NotionMovieDownloadInfo = Pick<
  NotionMovieListItem,
  "routeId" | "title" | "downloadUrl" | "extractionCode" | "hasDownloadInfo"
>;

export type NotionMovieDetail = NotionMovieListItem & {
  blocks: NotionBlock[];
};

export type PublicNotionMovieDetail = PublicNotionMovieListItem & {
  blocks: NotionBlock[];
};

export type NotionMovieTranslation = {
  pageId: string;
  updatedAt?: string;
  moviePageId: string;
  locale: string;
  slug: string;
  title: string;
  director: string;
  actors: string;
  summary: string;
  genres: string[];
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  editUrl: string | null;
  sourceUrl: string | null;
};

export type LocalizedPublicMovieListItem = PublicNotionMovieListItem & {
  locale: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
};

export type LocalizedPublicMovieDetail = LocalizedPublicMovieListItem & {
  blocks: NotionBlock[];
};

export type NotionRichTextPart = {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  type?: string;
  text?: {
    content?: string;
    link?: { url?: string } | null;
  };
  equation?: {
    expression?: string;
  };
};

export type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  children?: NotionBlock[];
  [key: string]: unknown;
};

export type NotionPageLike = {
  id: string;
  created_time?: string;
  last_edited_time?: string;
  cover?: unknown;
  properties?: Record<string, unknown>;
  url?: string;
  public_url?: string | null;
};

export type NotionFieldMap = Record<
  string,
  string | readonly string[]
>;

export type NotionSortDirection = "ascending" | "descending";

export type NotionSort = {
  property: string;
  direction: NotionSortDirection;
};

/**
 * Structural subset of the starter's `ContentModelDefinition` consumed by
 * the foundation's Notion helpers. Projects that want to plug in their own
 * content models must satisfy this shape.
 */
export type NotionContentModelLike = {
  source: {
    tokenEnv: string;
    dataSourceEnv: string;
    defaultDataSourceId?: string;
  };
};

export type NotionGenericContentModel = {
  id: string;
  source: {
    tokenEnv: string;
    dataSourceEnv: string;
    defaultDataSourceId?: string;
    fields: NotionFieldMap;
    query: {
      pageSize: number;
      sorts?: readonly NotionSort[];
      filterProperties?: readonly string[];
    };
  };
};

