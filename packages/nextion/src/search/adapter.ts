// packages/nextion/src/search/adapter.ts
//
// SearchAdapter abstraction — a pluggable interface for content
// search backends. The default implementation is D1-based text
// search (see `d1-adapter.ts`). Future implementations can back
// this with Cloudflare Vectorize or Workers AI for semantic search
// without changing the consumer surface.

/**
 * A document to be indexed by the search backend.
 *
 * Mirrors `SearchIndexDocument` from `content/search-index.ts` but
 * is declared here as the canonical shape so adapters do not depend
 * on the content layer.
 */
export interface SearchDocument {
  modelId: string;
  pageId: string;
  routeId: string;
  title: string;
  summary: string;
  bodyText: string;
  facets: readonly string[];
  sourceUpdatedAt?: string | null;
}

/**
 * Query parameters for a search request.
 */
export interface SearchQuery {
  /**
   * Scope to a single content source by its model ID. Omit to
   * search across all indexed sources.
   */
  modelId?: string;
  query: string;
  limit?: number;
}

/**
 * A single search result. Contains enough information for the UI
 * to render a result list without a second lookup.
 */
export interface SearchResult {
  modelId: string;
  routeId: string;
  title: string;
  summary: string;
  /** Relevance score (0–1). Optional for text search backends. */
  score?: number;
}

/**
 * Target for deleting a single document.
 */
export interface SearchDeleteTarget {
  modelId: string;
  routeId: string;
}

/**
 * Pluggable search backend. The worker bootstrap accepts an
 * optional `SearchAdapter` instance; when present, it registers
 * the `/api/search` route automatically.
 *
 * The default implementation (`D1SearchAdapter`) uses D1 `LIKE`
 * queries on the `content_search_index` table. Future
 * implementations can wrap Cloudflare Vectorize or Workers AI
 * without changing consumers.
 */
export interface SearchAdapter {
  /** Upsert a single document into the search index. */
  index(document: SearchDocument): Promise<void>;
  /** Query the index and return matching results. */
  query(params: SearchQuery): Promise<SearchResult[]>;
  /** Delete a single document from the index. */
  delete(target: SearchDeleteTarget): Promise<void>;
  /** Delete all documents for a given content source. */
  deleteForModel(target: { modelId: string }): Promise<void>;
  /**
   * Return route IDs that are not yet indexed for the given model.
   * Used by the prewarm flow to backfill missing entries.
   */
  getMissingRouteIds(params: {
    modelId: string;
    routeIds: readonly string[];
  }): Promise<string[]>;
}
