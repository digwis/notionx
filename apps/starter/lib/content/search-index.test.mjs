import test from "node:test";
import assert from "node:assert/strict";
import {
  filterItemsBySearchIndex,
  getMissingSearchIndexRouteIds,
  querySearchIndexRouteIds,
  upsertSearchIndexDocument,
} from "./search-index.ts";

function createMemoryDb() {
  const rows = new Map();
  const key = (modelId, routeId) => `${modelId}:${routeId}`;

  return {
    rows,
    prepare(query) {
      const state = { query, values: [] };
      const statement = {
        bind(...values) {
          state.values = values;
          return statement;
        },
        async run() {
          if (query.startsWith("INSERT INTO content_search_index")) {
            const [
              modelId,
              pageId,
              routeId,
              title,
              summary,
              bodyText,
              facets,
              normalizedText,
              sourceUpdatedAt,
            ] = state.values;
            rows.set(key(modelId, routeId), {
              model_id: modelId,
              page_id: pageId,
              route_id: routeId,
              title,
              summary,
              body_text: bodyText,
              facets,
              normalized_text: normalizedText,
              source_updated_at: sourceUpdatedAt,
              indexed_at: "2026-06-09T00:00:00.000Z",
            });
          }
          return { success: true };
        },
        async all() {
          if (query.includes("route_id IN")) {
            const [modelId, ...routeIds] = state.values;
            return {
              results: routeIds
                .filter((routeId) => rows.has(key(modelId, routeId)))
                .map((routeId) => ({ route_id: routeId })),
            };
          }

          const [modelId, ...rest] = state.values;
          const limit = rest.at(-1);
          const terms = rest.slice(0, -1).filter((_, index) => index % 4 === 0);
          return {
            results: Array.from(rows.values())
              .filter((row) => row.model_id === modelId)
              .filter((row) =>
                terms.every((term) =>
                  row.normalized_text.includes(String(term).replaceAll("%", ""))
                )
              )
              .slice(0, limit)
              .map((row) => ({ route_id: row.route_id })),
          };
        },
      };
      return statement;
    },
    async batch() {
      return [];
    },
  };
}

test("search index stores flattened body text and returns matching routes", async () => {
  const db = createMemoryDb();
  await upsertSearchIndexDocument(db, {
    modelId: "blog",
    pageId: "page-1",
    routeId: "edge-cache",
    title: "边缘缓存",
    summary: "标题摘要",
    bodyText: "正文提到 Notion blocks 和 Workers KV",
    facets: ["Cloudflare"],
  });

  assert.deepEqual(await querySearchIndexRouteIds(db, {
    modelId: "blog",
    query: "blocks kv",
  }), ["edge-cache"]);
  assert.deepEqual(await querySearchIndexRouteIds(db, {
    modelId: "blog",
    query: "missing",
  }), []);
});

test("filterItemsBySearchIndex falls back when no index matches", async () => {
  const db = createMemoryDb();
  const items = [
    { routeId: "a", title: "Alpha", summary: "metadata match" },
    { routeId: "b", title: "Beta", summary: "other" },
  ];

  const filtered = await filterItemsBySearchIndex(items, "metadata", {
    modelId: "movies",
    getDatabase: () => db,
    filterFallback: (input, query) =>
      input.filter((item) => item.summary.includes(query)),
  });

  assert.deepEqual(filtered.map((item) => item.routeId), ["a"]);
});

test("getMissingSearchIndexRouteIds returns only absent route ids", async () => {
  const db = createMemoryDb();
  await upsertSearchIndexDocument(db, {
    modelId: "blog",
    pageId: "page-1",
    routeId: "present",
    title: "Present",
    summary: "",
    bodyText: "",
    facets: [],
  });

  assert.deepEqual(
    await getMissingSearchIndexRouteIds(db, {
      modelId: "blog",
      routeIds: ["present", "missing"],
    }),
    ["missing"]
  );
});
