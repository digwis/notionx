// 公开页 Cloudflare 边缘 HTML 缓存键生成。
//
// 规则：
// 1) 去掉 query / hash
// 2) 去掉尾部斜杠
// 3) 用固定 origin 作为 cache key 命名空间，方便和 Worker 内部 caches.default 对齐

const CACHE_ORIGIN = "https://cache.local";

function normalizePath(pathname: string) {
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function publicCacheKey(pathname: string) {
  return `${CACHE_ORIGIN}${normalizePath(pathname)}`;
}

export function publicCacheKeysForSlug(slug: string) {
  return [publicCacheKey("/blog"), publicCacheKey(`/blog/${slug}`)];
}
