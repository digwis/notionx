// packages/nextion/src/search/d1-adapter.ts
//
// D1-backed SearchAdapter implementation. Wraps the existing
// `content/search-index.ts` functions behind the `SearchAdapter`
// interface so consumers (worker bootstrap, scaffold templates)
// can depend on the abstraction rather than D1 directly.
//
// The `query` method extends `querySearchIndexRouteIds` by
// returning full result rows (title, summary) instead of just
// route IDs, so the search UI can render results without a
// second D1 lookup.

import type { SqlDatabaseAdapter } from "../platform/runtime";
import { normalizeSearchQuery } from "../content/search";
import {
  deleteSearchIndexDocument,
  deleteSearchIndexForModel,
  getMissingSearchIndexRouteIds,
  upsertSearchIndexDocument,
} from "../content/search-index";
import type {
  SearchAdapter,
  SearchDeleteTarget,
  SearchDocument,
  SearchQuery,
  SearchResult,
} from "./adapter";

type D1SearchRow = {
  model_id: string;
  route_id: string;
  title: string;
  summary: string;
};

/**
 * Build a D1SearchAdapter bound to a specific database instance.
 *
 * The database is resolved lazily via `getDatabase` so the adapter
 * can be created at module load time (before the Cloudflare `env`
 * is available) and resolve the binding on the first request.
 */
export function createD1SearchAdapter(
  getDatabase: () => SqlDatabaseAdapter
): SearchAdapter {
  return {
    async index(document: SearchDocument): Promise<void> {
      await upsertSearchIndexDocument(getDatabase(), document);
    },

    async query(params: SearchQuery): Promise<SearchResult[]> {
      const query = normalizeSearchQuery(params.query);
      if (!query) return [];

      const terms = query.split(" ").map((term) => `%${term}%`);
      const clauses = terms
        .map(
          () =>
            "(normalized_text LIKE ? OR title LIKE ? OR summary LIKE ? OR facets LIKE ?)"
        )
        .join(" AND ");
      const values = terms.flatMap((term) => [term, term, term, term]);

      const db = getDatabase();
      const modelFilter = params.modelId
        ? "WHERE model_id = ?"
        : "WHERE 1=1";
      const binds = params.modelId
        ? [params.modelId, ...values, params.limit ?? 200]
        : [...values, params.limit ?? 200];

      const result = await db
        .prepare(
          `SELECT model_id, route_id, title, summary
           FROM content_search_index
           ${modelFilter} AND ${clauses}
           ORDER BY indexed_at DESC
           LIMIT ?`
        )
        .bind(...binds)
        .all<D1SearchRow>();

      return (result.results ?? []).map((row) => ({
        modelId: row.model_id,
        routeId: row.route_id,
        title: row.title,
        summary: row.summary,
      }));
    },

    async delete(target: SearchDeleteTarget): Promise<void> {
      await deleteSearchIndexDocument(getDatabase(), target);
    },

    async deleteForModel(target: { modelId: string }): Promise<void> {
      await deleteSearchIndexForModel(getDatabase(), target);
    },

    async getMissingRouteIds(params: {
      modelId: string;
      routeIds: readonly string[];
    }): Promise<string[]> {
      return getMissingSearchIndexRouteIds(getDatabase(), params);
    },
  };
}
