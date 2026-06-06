import { publicCacheKey } from "./cache-keys.ts";

export type InvalidationKind = "publish" | "update" | "delete";

export type InvalidationInput = {
  slug: string;
  kind: InvalidationKind;
  previousSlug?: string;
};

export type InvalidationPlan = {
  kind: InvalidationKind;
  slug: string;
  keys: string[];
};

// 给定一次影响公开页的内容变更，计算需要失效的边缘缓存键集合。
// 当前单一主缓存层是 Cloudflare 边缘 HTML 缓存；该函数返回的 keys
// 与 lib/cache-keys.ts 的 publicCacheKey 保持完全一致。
export function buildInvalidationPlan(input: InvalidationInput): InvalidationPlan {
  const set = new Set<string>();
  set.add(publicCacheKey("/blog"));
  set.add(publicCacheKey(`/blog/${input.slug}`));
  if (input.previousSlug) {
    set.add(publicCacheKey(`/blog/${input.previousSlug}`));
  }
  return {
    kind: input.kind,
    slug: input.slug,
    keys: Array.from(set),
  };
}
