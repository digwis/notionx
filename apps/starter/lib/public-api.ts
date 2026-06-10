export const PUBLIC_JSON_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export const PRIVATE_JSON_CACHE_CONTROL = "private, no-store";

export const PUBLIC_JSON_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

export function publicJsonHeaders(
  extra?: Record<string, string>
): Record<string, string> {
  return {
    ...PUBLIC_JSON_CORS_HEADERS,
    "Cache-Control": PUBLIC_JSON_CACHE_CONTROL,
    ...extra,
  };
}

/** Skip CDN caching when list APIs are filtered or searched. */
export function publicJsonHeadersForListRequest(
  searchParams: URLSearchParams,
  uncachedParams: string[] = ["q"]
) {
  const hasUncachedParam = uncachedParams.some(
    (name) => (searchParams.get(name) ?? "").trim().length > 0
  );
  if (hasUncachedParam) {
    return publicJsonHeaders({ "Cache-Control": PRIVATE_JSON_CACHE_CONTROL });
  }
  return publicJsonHeaders();
}

export function publicOptionsHeaders() {
  return {
    ...PUBLIC_JSON_CORS_HEADERS,
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
