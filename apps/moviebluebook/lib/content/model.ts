// apps/moviebluebook/lib/content/model.ts
//
// Re-exports the foundation's content-source shape and adds a
// `defineContentModel` alias for the legacy factory name. New code
// should prefer `defineContentSource` from `@vinext/foundation/content`,
// which has the additional side effect of registering the source in
// the package's module-level registry.
import {
  defineContentSource,
  type ContentModelDefinition,
  type NotionFieldMap,
  type NotionSort,
  type NotionSortDirection,
} from "@vinext/foundation/content";

export type { ContentModelDefinition, NotionFieldMap, NotionSort, NotionSortDirection };

/**
 * Legacy alias for `defineContentSource`. Returns the value unchanged
 * without registering it in the package's content-source registry.
 * Kept for existing call sites (e.g. the generic Notion tests that
 * build throwaway models); new code should use
 * `defineContentSource` from `@vinext/foundation/content` so the
 * source becomes discoverable.
 */
export function defineContentModel<const TFields extends NotionFieldMap>(
  model: ContentModelDefinition<TFields>
): ContentModelDefinition<TFields> {
  return defineContentSource(model);
}
