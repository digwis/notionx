// packages/nextion/src/worker/routes/search.ts
//
// GET /api/search?q=...&modelId=...&limit=...
//
// Search route handler. Registered by the worker bootstrap only
// when a `SearchAdapter` is present in `FoundationWorkerOptions`.
// Returns JSON results suitable for client-side search UIs.

import type { SearchAdapter } from "../../search/adapter";

export interface SearchRouteOptions {
  adapter: SearchAdapter;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function createSearchRouteHandler(options: SearchRouteOptions) {
  return async function handleSearchRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const modelId = url.searchParams.get("modelId") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 200) : 20;

    if (!query.trim()) {
      return jsonResponse({ results: [], query: "" });
    }

    try {
      const results = await options.adapter.query({ query, modelId, limit });
      return jsonResponse({ results, query, count: results.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse(
        { error: "search_failed", message, results: [] },
        500
      );
    }
  };
}
