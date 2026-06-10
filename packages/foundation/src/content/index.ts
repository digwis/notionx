// packages/foundation/src/content/index.ts
//
// Public surface for `@vinext/foundation/content`. Re-exports the
// content model registry helpers. The other framework modules
// (revalidate, search, search-index, prewarm, admin-summary) join the
// surface in a follow-up commit.
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
