import type { KeyValueCacheAdapter } from "../platform/runtime.ts";
import type { NotionBlock } from "./types.ts";

const CACHE_VERSION = "v2";
export const NOTION_LIST_CACHE_TTL_SECONDS = 300;
export const NOTION_BLOCKS_CACHE_TTL_SECONDS = 60 * 60 * 24;
const CONTENT_CACHE_READ_TTL_SECONDS = 60;

export type NotionContentCacheDeleteResult = {
  ok: boolean;
  skipped: boolean;
  deleted: string[];
  failed: Array<{ key?: string; error: string }>;
};

type CacheableValue = Record<string, unknown> | unknown[] | null;

function modelPrefix(modelId: string) {
  return `notion:${CACHE_VERSION}:${modelId}`;
}

export function notionModelListCacheKey(modelId: string) {
  return `${modelPrefix(modelId)}:list`;
}

function versionSegment(value?: string) {
  const version = String(value ?? "").trim();
  return version ? `:v:${encodeURIComponent(version)}` : "";
}

export function notionPageBlocksCacheKey(
  modelId: string,
  pageId: string,
  cacheVersion?: string
) {
  return `${modelPrefix(modelId)}:page:${pageId}:blocks${versionSegment(cacheVersion)}`;
}

export function notionModelCachePrefix(modelId: string) {
  return `${modelPrefix(modelId)}:`;
}

export function notionPageCachePrefix(modelId: string, pageId: string) {
  return `${modelPrefix(modelId)}:page:${pageId}:`;
}

function logNotionContentCache(fields: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ tag: "notion_content_cache", ...fields }));
  } catch {
    // Ignore logging serialization errors.
  }
}

export async function getCachedNotionValue<T extends CacheableValue>(
  cache: KeyValueCacheAdapter | null | undefined,
  key: string
): Promise<T | null> {
  if (!cache) return null;
  try {
    const value = await cache.get<T>(key, {
      cacheTtl: CONTENT_CACHE_READ_TTL_SECONDS,
    });
    logNotionContentCache({
      op: "get",
      key,
      hit: value !== null,
      cache: cache.kind,
    });
    return value;
  } catch (error) {
    logNotionContentCache({
      op: "get_error",
      key,
      cache: cache.kind,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function putCachedNotionValue<T extends CacheableValue>(
  cache: KeyValueCacheAdapter | null | undefined,
  key: string,
  value: T,
  options?: { expirationTtl?: number }
) {
  if (!cache) return;
  try {
    await cache.put(key, value, {
      expirationTtl: options?.expirationTtl ?? NOTION_BLOCKS_CACHE_TTL_SECONDS,
      metadata: {
        source: "notion",
        cachedAt: new Date().toISOString(),
      },
    });
    logNotionContentCache({
      op: "put",
      key,
      cache: cache.kind,
    });
  } catch (error) {
    logNotionContentCache({
      op: "put_error",
      key,
      cache: cache.kind,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getCachedNotionBlocks(
  cache: KeyValueCacheAdapter | null | undefined,
  input: { modelId: string; pageId: string; cacheVersion?: string }
) {
  return getCachedNotionValue<NotionBlock[]>(
    cache,
    notionPageBlocksCacheKey(input.modelId, input.pageId, input.cacheVersion)
  );
}

export async function putCachedNotionBlocks(
  cache: KeyValueCacheAdapter | null | undefined,
  input: {
    modelId: string;
    pageId: string;
    cacheVersion?: string;
    blocks: NotionBlock[];
  }
) {
  await putCachedNotionValue(
    cache,
    notionPageBlocksCacheKey(input.modelId, input.pageId, input.cacheVersion),
    input.blocks,
    { expirationTtl: NOTION_BLOCKS_CACHE_TTL_SECONDS }
  );
}

export async function deleteNotionContentCache(input: {
  modelId: string;
  pageId?: string;
  routeId?: string;
  previousRouteId?: string;
  cache?: KeyValueCacheAdapter | null;
  getCache?: () => KeyValueCacheAdapter | null;
}): Promise<NotionContentCacheDeleteResult> {
  let cache: KeyValueCacheAdapter | null;
  try {
    cache = input.cache ?? input.getCache?.() ?? null;
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      deleted: [],
      failed: [
        {
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  if (!cache) {
    return { ok: true, skipped: true, deleted: [], failed: [] };
  }

  const prefixes = new Set<string>();
  if (input.pageId) {
    prefixes.add(notionPageCachePrefix(input.modelId, input.pageId));
  } else {
    prefixes.add(notionModelCachePrefix(input.modelId));
  }

  prefixes.add(notionModelListCacheKey(input.modelId));

  const deleted: string[] = [];
  const failed: Array<{ key?: string; error: string }> = [];

  for (const prefix of prefixes) {
    let cursor: string | undefined;
    do {
      try {
        const result = await cache.list({ prefix, cursor, limit: 100 });
        for (const { name } of result.keys) {
          try {
            await cache.delete(name);
            deleted.push(name);
          } catch (error) {
            failed.push({
              key: name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        cursor = result.listComplete ? undefined : result.cursor;
      } catch (error) {
        failed.push({
          key: prefix,
          error: error instanceof Error ? error.message : String(error),
        });
        cursor = undefined;
      }
    } while (cursor);
  }

  return {
    ok: failed.length === 0,
    skipped: false,
    deleted,
    failed,
  };
}
