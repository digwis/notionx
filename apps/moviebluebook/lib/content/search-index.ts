// Re-exports the foundation's content search index helpers. The
// starter's `search-index.ts` used to define the same generic
// helpers; they now live in `@vinext/foundation/content`.
export {
  deleteSearchIndexDocument,
  deleteSearchIndexForModel,
  filterItemsBySearchIndex,
  getMissingSearchIndexRouteIds,
  matchesIndexedItem,
  querySearchIndexRouteIds,
  upsertSearchIndexDocument,
  type SearchIndexDocument,
  type SearchIndexedItem,
} from "@vinext/foundation/content";
