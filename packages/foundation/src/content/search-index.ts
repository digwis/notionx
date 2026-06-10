// packages/foundation/src/content/search-index.ts
//
// Generic D1-backed content search index helpers.

import type { SqlDatabaseAdapter } from "../platform/runtime";
import { matchesSearchQuery, normalizeSearchQuery } from "./search";

export type SearchIndexedItem = {
  pageId?: string;
  slug?: string;
  routeId?: string;
  title: string;
  description?: string;
  date?: string;
  author?: string;
  tags?: readonly string[];
  releaseDate?: string;
  director?: string;
  actors?: string;
  summary?: string;
  genres?: readonly string[];
};

export type SearchIndexDocument = {
  modelId: string;
  pageId: string;
  routeId: string;
  title: string;
  summary: string;
  bodyText: string;
  facets: readonly string[];
  sourceUpdatedAt?: string | null;
};

type SearchIndexRow = {
  route_id: string;
};

type MaybePromise<T> = T | Promise<T>;

function indexValuesForItem(item: SearchIndexedItem) {
  return [
    item.title,
    item.description,
    item.author,
    item.tags,
    item.slug,
    item.date,
    item.summary,
    item.director,
    item.actors,
    item.genres,
    item.routeId,
    item.releaseDate,
  ];
}

function routeIdForItem(item: SearchIndexedItem) {
  return item.routeId ?? item.slug ?? "";
}

function routeOrder<T extends SearchIndexedItem>(items: readonly T[]) {
  const order = new Map<string, number>();
  items.forEach((item, index) => {
    const routeId = routeIdForItem(item);
    if (routeId) order.set(routeId, index);
  });
  return order;
}

function uniqueValues(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export async function upsertSearchIndexDocument(
  db: SqlDatabaseAdapter,
  document: SearchIndexDocument
) {
  const normalizedText = [
    document.title,
    document.summary,
    document.bodyText,
    ...document.facets,
  ]
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLowerCase();

  await db
    .prepare(
      `INSERT INTO content_search_index (
        model_id,
        page_id,
        route_id,
        title,
        summary,
        body_text,
        facets,
        normalized_text,
        source_updated_at,
        indexed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(model_id, route_id) DO UPDATE SET
        page_id = excluded.page_id,
        title = excluded.title,
        summary = excluded.summary,
        body_text = excluded.body_text,
        facets = excluded.facets,
        normalized_text = excluded.normalized_text,
        source_updated_at = excluded.source_updated_at,
        indexed_at = excluded.indexed_at`
    )
    .bind(
      document.modelId,
      document.pageId,
      document.routeId,
      document.title,
      document.summary,
      document.bodyText,
      JSON.stringify(uniqueValues([...document.facets])),
      normalizedText,
      document.sourceUpdatedAt ?? null
    )
    .run();
}

export async function deleteSearchIndexDocument(
  db: SqlDatabaseAdapter,
  input: { modelId: string; routeId: string }
) {
  await db
    .prepare(
      "DELETE FROM content_search_index WHERE model_id = ? AND route_id = ?"
    )
    .bind(input.modelId, input.routeId)
    .run();
}

export async function deleteSearchIndexForModel(
  db: SqlDatabaseAdapter,
  input: { modelId: string }
) {
  await db
    .prepare("DELETE FROM content_search_index WHERE model_id = ?")
    .bind(input.modelId)
    .run();
}

export async function getMissingSearchIndexRouteIds(
  db: SqlDatabaseAdapter,
  input: { modelId: string; routeIds: readonly string[] }
) {
  const routeIds = uniqueValues([...input.routeIds]);
  if (routeIds.length === 0) return [];

  const placeholders = routeIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT route_id
       FROM content_search_index
       WHERE model_id = ? AND route_id IN (${placeholders})`
    )
    .bind(input.modelId, ...routeIds)
    .all<SearchIndexRow>();

  const present = new Set((result.results ?? []).map((row) => row.route_id));
  return routeIds.filter((routeId) => !present.has(routeId));
}

export async function querySearchIndexRouteIds(
  db: SqlDatabaseAdapter,
  input: { modelId: string; query: string; limit?: number }
) {
  const query = normalizeSearchQuery(input.query);
  if (!query) return [];

  const terms = query
    .split(" ")
    .map((term) => `%${term}%`);
  const clauses = terms
    .map(
      () =>
        "(normalized_text LIKE ? OR title LIKE ? OR summary LIKE ? OR facets LIKE ?)"
    )
    .join(" AND ");
  const values = terms.flatMap((term) => [term, term, term, term]);

  const result = await db
    .prepare(
      `SELECT route_id
       FROM content_search_index
       WHERE model_id = ? AND ${clauses}
       ORDER BY indexed_at DESC
       LIMIT ?`
    )
    .bind(input.modelId, ...values, input.limit ?? 200)
    .all<SearchIndexRow>();

  return (result.results ?? [])
    .map((row) => row.route_id)
    .filter((routeId): routeId is string => typeof routeId === "string");
}

export async function filterItemsBySearchIndex<T extends SearchIndexedItem>(
  items: readonly T[],
  query: string | null | undefined,
  input: {
    modelId: string;
    filterFallback: (items: readonly T[], query: string | null | undefined) => T[];
    getDatabase?: () => MaybePromise<SqlDatabaseAdapter | null>;
  }
) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [...items];
  if (!input.getDatabase) return input.filterFallback(items, normalized);

  try {
    const db = await input.getDatabase();
    if (!db) return input.filterFallback(items, normalized);
    const routeIds = await querySearchIndexRouteIds(db, {
      modelId: input.modelId,
      query: normalized,
      limit: Math.max(items.length, 200),
    });
    if (routeIds.length === 0) return input.filterFallback(items, normalized);

    const order = routeOrder(items);
    const matched = new Set(routeIds);
    return items
      .filter((item) => matched.has(routeIdForItem(item)))
      .sort(
        (a, b) =>
          (order.get(routeIdForItem(a)) ?? 0) -
          (order.get(routeIdForItem(b)) ?? 0)
      );
  } catch (error) {
    console.warn(
      JSON.stringify({
        tag: "content_search_index_error",
        modelId: input.modelId,
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return input.filterFallback(items, normalized);
  }
}

export function matchesIndexedItem(
  item: SearchIndexedItem,
  query: string | null | undefined
) {
  return matchesSearchQuery(indexValuesForItem(item), query);
}
