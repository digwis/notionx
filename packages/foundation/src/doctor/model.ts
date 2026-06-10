// Local model types used by the doctor module.
// Project-specific content models (built on `defineContentSource`) are
// mapped to this shape internally for diagnostic reporting.

export type NotionSortDirection = "ascending" | "descending";

export type NotionSort = {
  property: string;
  direction: NotionSortDirection;
};

export type NotionFieldMap = Record<string, string | readonly string[]>;

export type ContentModelDefinition<TFields extends NotionFieldMap = NotionFieldMap> = {
  id: string;
  kind: "article" | "catalog" | "directory";
  visibility: {
    public: boolean;
    admin: boolean;
  };
  source: {
    type: "notion";
    tokenEnv: "NOTION_TOKEN";
    dataSourceEnv: string;
    defaultDataSourceId?: string;
    fields: TFields;
    query: {
      pageSize: number;
      sorts?: readonly NotionSort[];
      filterProperties?: readonly string[];
    };
  };
  routes: {
    listPath: string;
    detailPath: string;
    detailParam: string;
    publicApiPath?: string;
  };
  ui: {
    name: string;
    pluralName: string;
    navLabel: string;
    listTitle: string;
    listDescription: string;
    emptyState: string;
  };
  capabilities: {
    richBlocks: boolean;
    coverImages: boolean;
    gatedAssets: boolean;
  };
};
