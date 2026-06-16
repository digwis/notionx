// packages/nextion/src/search/index.ts
//
// Public surface for `@notionx/core/search`. Re-exports the
// SearchAdapter interface and the D1 default implementation.

export type {
  SearchAdapter,
  SearchDeleteTarget,
  SearchDocument,
  SearchQuery,
  SearchResult,
} from "./adapter";

export { createD1SearchAdapter } from "./d1-adapter";
