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
  routeId: string;
  title: string;
  releaseDate: string;
  director: string;
  actors: string;
  summary: string;
  genres: string[];
  downloadText: string;
  downloadUrl: string | null;
  coverImage: string | null;
  editUrl: string | null;
  sourceUrl: string | null;
};

export type NotionMovieDetail = NotionMovieListItem & {
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
  last_edited_time?: string;
  cover?: unknown;
  properties?: Record<string, unknown>;
  url?: string;
  public_url?: string | null;
};
