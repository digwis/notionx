// packages/foundation/src/content/models.ts
//
// Canonical content-source shape and a module-level registry.
//
// The starter's `defineContentModel` returns the same value passed in.
// The foundation's `defineContentSource` adds a side effect: it stores
// the value in a process-wide registry so other packages (admin pages,
// search index, revalidation) can discover content sources without
// reaching back into the starter.
//
// Existing values from the starter pass through unchanged: `ContentSource`
// is a structural alias of the prior `ContentModelDefinition<TFields>` so
// source field-maps stay narrowly typed through the boundary.

import type {
  NotionFieldMap,
  NotionSort,
  NotionSortDirection,
} from "../notion/types";

export type { NotionFieldMap, NotionSort, NotionSortDirection };

/**
 * Canonical content-source shape. The shape mirrors the starter's
 * prior `ContentModelDefinition` exactly so that registered sources
 * remain type-compatible across the package boundary.
 */
export type ContentModelDefinition<
  TFields extends NotionFieldMap = NotionFieldMap,
> = {
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

/**
 * Public alias for `ContentModelDefinition`. External consumers import
 * this name from `@vinext/foundation/content`; the internal
 * `ContentModelDefinition` name remains available for the starter's
 * `model.ts`.
 */
export type ContentSource<
  TFields extends NotionFieldMap = NotionFieldMap,
> = ContentModelDefinition<TFields>;

const registry: ContentSource[] = [];

/**
 * Register a content source. Returns the value unchanged. Re-registering
 * the same `id` replaces the prior value (idempotent on the id, useful
 * for HMR + tests).
 */
export function defineContentSource<const TFields extends NotionFieldMap>(
  model: ContentModelDefinition<TFields>
): ContentModelDefinition<TFields> {
  const existing = registry.findIndex((s) => s.id === model.id);
  if (existing >= 0) registry[existing] = model;
  else registry.push(model);
  return model;
}

export function getRegisteredSources(): readonly ContentSource[] {
  return registry;
}

export function getRegisteredSource(id: string): ContentSource | undefined {
  return registry.find((s) => s.id === id);
}

/**
 * Test-only escape hatch: empties the registry so vitest cases do not
 * leak state between files. Not for production use.
 */
export function clearRegistryForTests(): void {
  registry.length = 0;
}
