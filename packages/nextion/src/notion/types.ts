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
 * nextion's Notion helpers. Projects that want to plug in their own
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
