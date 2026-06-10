// Re-exports the foundation's content search helpers. The starter's
// `search.ts` used to define the same generic helpers; they now live
// in `@vinext/foundation/content`.
export {
  filterMoviesBySearch,
  filterPostsBySearch,
  matchesSearchQuery,
  normalizeSearchQuery,
} from "@vinext/foundation/content";
