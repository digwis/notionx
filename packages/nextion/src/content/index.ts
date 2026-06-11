// packages/nextion/src/content/index.ts
//
// Public surface for `@notionx/core/content`. Re-exports the
// content model registry helpers and the moved framework modules.

export {
  defineContentSource,
  getRegisteredSource,
  getRegisteredSources,
  clearRegistryForTests,
  type ContentModelDefinition,
  type ContentSource,
  type NotionFieldMap,
  type NotionSort,
  type NotionSortDirection,
} from "./models";

export {
  authorizeContentRevalidate,
  buildContentRevalidationPaths,
  previewContentModelInvalidation,
  readContentRevalidateRequest,
  readContentRevalidateRequestFromUrl,
  type ContentRevalidateRequest,
  type InvalidationKind,
  type RevalidatePathFn,
} from "./revalidate";

export {
  filterItemsBySearchIndex,
  getMissingSearchIndexRouteIds,
  matchesIndexedItem,
  querySearchIndexRouteIds,
  deleteSearchIndexDocument,
  deleteSearchIndexForModel,
  upsertSearchIndexDocument,
  type SearchIndexDocument,
  type SearchIndexedItem,
} from "./search-index";

export {
  filterMoviesBySearch,
  filterPostsBySearch,
  matchesSearchQuery,
  normalizeSearchQuery,
} from "./search";

export {
  prewarmPublicContentSearchIndex,
  type ContentPrewarmModelResult,
  type ContentPrewarmResult,
  type PrewarmTarget,
} from "./prewarm";

export {
  getContentModelAdminSummaries,
  summarizeContentModelForAdmin,
  type ContentModelAdminSummary,
} from "./admin-summary";
