// 公开页与公开 API 的 Cloudflare 边缘缓存键生成。
//
// HTML 规则：
// 1) 去掉 query / hash
// 2) 去掉尾部斜杠
// 3) 用固定 origin 作为 cache key 命名空间，方便和 Worker 内部 caches.default 对齐

const CACHE_ORIGIN = "https://cache.local";
const CACHE_NAMESPACE = "/__public-cache/v20260608c";
const NOTION_MEDIA_R2_PREFIX = "notion-media/v1";

export type PublicMediaVariant = "avif" | "webp" | "source";

function normalizePath(pathname: string) {
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function publicCacheKey(pathname: string) {
  return `${CACHE_ORIGIN}${CACHE_NAMESPACE}${normalizePath(pathname)}`;
}

export function publicCacheKeysForSlug(slug: string) {
  return [publicCacheKey("/blog"), publicCacheKey(`/blog/${slug}`)];
}

export function publicMovieCacheKeysForRouteId(routeId: string) {
  return [publicCacheKey("/movies"), publicCacheKey(`/movies/${routeId}`)];
}

export function publicApiCacheKey(pathname: string, search = "") {
  const url = new URL(
    `${CACHE_NAMESPACE}${normalizePath(pathname)}${search}`,
    CACHE_ORIGIN
  );
  url.searchParams.sort();
  return url.toString();
}

export function publicApiCacheKeyForUrl(input: URL) {
  const url = new URL(
    `${CACHE_NAMESPACE}${normalizePath(input.pathname)}${input.search}`,
    input.origin
  );
  url.searchParams.sort();
  return url.toString();
}

export function publicMediaVariantForAccept(accept: string): PublicMediaVariant {
  if (accept.includes("image/avif")) return "avif";
  if (accept.includes("image/webp")) return "webp";
  return "source";
}

export function publicMediaCacheKeyForUrl(
  input: URL,
  variant: PublicMediaVariant
) {
  const url = new URL(
    `${CACHE_NAMESPACE}${normalizePath(input.pathname)}${input.search}`,
    CACHE_ORIGIN
  );
  url.searchParams.set("__variant", variant);
  url.searchParams.sort();
  return url.toString();
}

function keySegment(value: string) {
  return encodeURIComponent(value || "none");
}

export function notionMediaR2KeyForUrl(
  input: URL,
  variant: PublicMediaVariant
) {
  if (variant === "source") return null;

  const version = input.searchParams.get("v");
  if (!version) return null;

  const path = normalizePath(input.pathname)
    .split("/")
    .filter(Boolean)
    .map(keySegment)
    .join("/");
  const width = input.searchParams.get("w") ?? "source";
  const quality = input.searchParams.get("q") ?? "source";

  return [
    NOTION_MEDIA_R2_PREFIX,
    variant,
    path,
    `v-${keySegment(version)}`,
    `w-${keySegment(width)}`,
    `q-${keySegment(quality)}.${variant}`,
  ].join("/");
}
