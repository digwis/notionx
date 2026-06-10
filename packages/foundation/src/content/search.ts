// packages/foundation/src/content/search.ts
//
// Generic text-search helpers for content sources.

import type {
  NotionMovieListItem,
  NotionPostListItem,
} from "../notion/types";

export function normalizeSearchQuery(query: string | null | undefined) {
  return String(query ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function searchTerms(query: string | null | undefined) {
  const normalized = normalizeSearchQuery(query);
  return normalized ? normalized.split(" ") : [];
}

function searchableText(values: readonly unknown[]) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string | number | boolean =>
      ["string", "number", "boolean"].includes(typeof value)
    )
    .map((value) => String(value))
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
}

export function matchesSearchQuery(
  values: readonly unknown[],
  query: string | null | undefined
) {
  const terms = searchTerms(query);
  if (terms.length === 0) return true;

  const haystack = searchableText(values);
  return terms.every((term) => haystack.includes(term));
}

export function filterPostsBySearch<TPost extends NotionPostListItem>(
  posts: readonly TPost[],
  query: string | null | undefined
) {
  return posts.filter((post) =>
    matchesSearchQuery(
      [
        post.title,
        post.description,
        post.author,
        post.tags,
        post.slug,
        post.date,
      ],
      query
    )
  );
}

export function filterMoviesBySearch<TMovie extends NotionMovieListItem>(
  movies: readonly TMovie[],
  query: string | null | undefined
) {
  return movies.filter((movie) =>
    matchesSearchQuery(
      [
        movie.title,
        movie.summary,
        movie.director,
        movie.actors,
        movie.genres,
        movie.releaseDate,
        movie.routeId,
      ],
      query
    )
  );
}
