import type { AppEnv } from "../util/env";

export type PlatformBindingEnv = Pick<
  AppEnv,
  "ASSETS_BUCKET" | "CONTENT_CACHE" | "DB" | "IMAGES"
>;

export type StoredObject = {
  body: ReadableStream;
  size: number;
  etag?: string;
  contentType?: string;
};

export type ObjectStoragePutOptions = {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
};

export type ObjectStorageListItem = {
  key: string;
  size: number;
  uploaded: Date;
};

export type ObjectStorageAdapter = {
  kind: "r2";
  get(key: string): Promise<StoredObject | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: ObjectStoragePutOptions
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(
    options?: { prefix?: string; limit?: number }
  ): Promise<ObjectStorageListItem[]>;
};

export type ImageTransformOptions = {
  width?: number;
  format: "image/avif" | "image/webp";
  quality: number;
};

export type ImageTransformResult = {
  body: ReadableStream;
  contentType: string;
  response(): Response;
};

export type ImageTransformerAdapter = {
  kind: "cloudflare-images" | "external";
  transform(
    body: ReadableStream,
    options: ImageTransformOptions
  ): Promise<ImageTransformResult>;
};

export type PublicCacheAdapter = {
  kind: "cloudflare-cache" | "noop" | "external";
  match(key: string): Promise<Response | null>;
  put(key: string, response: Response): Promise<void>;
  delete(key: string): Promise<boolean>;
};

export type KeyValueCacheGetOptions = {
  cacheTtl?: number;
};

export type KeyValueCachePutOptions = {
  expirationTtl?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type KeyValueCacheListOptions = {
  prefix?: string;
  limit?: number;
  cursor?: string;
};

export type KeyValueCacheListResult = {
  keys: Array<{ name: string }>;
  cursor?: string;
  listComplete: boolean;
};

export type KeyValueCacheAdapter = {
  kind: "workers-kv" | "noop" | "external";
  get<T = unknown>(
    key: string,
    options?: KeyValueCacheGetOptions
  ): Promise<T | null>;
  put<T = unknown>(
    key: string,
    value: T,
    options?: KeyValueCachePutOptions
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KeyValueCacheListOptions): Promise<KeyValueCacheListResult>;
};

export type SqlValue = string | number | boolean | null;

export type SqlResult<T = Record<string, unknown>> = {
  results?: T[];
  success?: boolean;
  meta?: {
    changes?: number;
    duration?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
    [key: string]: unknown;
  };
};

export type SqlPreparedStatement = {
  bind(...values: SqlValue[]): SqlPreparedStatement;
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
};

export type SqlDatabaseAdapter = {
  kind: "d1";
  prepare(query: string): SqlPreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: SqlPreparedStatement[]
  ): Promise<SqlResult<T>[]>;
};

export type RuntimePlatform = {
  id: "cloudflare-workers";
  database: SqlDatabaseAdapter | null;
  objectStorage: ObjectStorageAdapter | null;
  imageTransformer: ImageTransformerAdapter | null;
  publicCache: PublicCacheAdapter | null;
  keyValueCache: KeyValueCacheAdapter | null;
};

type CloudflareCacheLike = Pick<Cache, "match" | "put" | "delete">;
type CloudflareKvLike = Pick<KVNamespace, "get" | "put" | "delete" | "list">;

function cacheRequestForKey(key: string) {
  return new Request(key, { method: "GET" });
}

export function createCloudflarePublicCacheAdapter(
  cache: CloudflareCacheLike
): PublicCacheAdapter {
  return {
    kind: "cloudflare-cache",
    async match(key) {
      return (await cache.match(cacheRequestForKey(key))) ?? null;
    },
    put(key, response) {
      return cache.put(cacheRequestForKey(key), response);
    },
    delete(key) {
      return cache.delete(cacheRequestForKey(key));
    },
  };
}

export function createNoopPublicCacheAdapter(kind: "noop" = "noop"): PublicCacheAdapter {
  return {
    kind,
    async match() {
      return null;
    },
    async put() {},
    async delete() {
      return false;
    },
  };
}

export function createCloudflareKeyValueCacheAdapter(
  namespace: CloudflareKvLike
): KeyValueCacheAdapter {
  return {
    kind: "workers-kv",
    async get<T = unknown>(
      key: string,
      options?: KeyValueCacheGetOptions
    ): Promise<T | null> {
      return (await namespace.get(key, {
        type: "json",
        cacheTtl: options?.cacheTtl,
      })) as T | null;
    },
    async put(key, value, options) {
      await namespace.put(key, JSON.stringify(value), {
        expirationTtl: options?.expirationTtl,
        metadata: options?.metadata,
      });
    },
    delete(key) {
      return namespace.delete(key);
    },
    async list(options) {
      const result = await namespace.list({
        prefix: options?.prefix,
        limit: options?.limit,
        cursor: options?.cursor,
      });
      return {
        keys: result.keys.map((key) => ({ name: key.name })),
        cursor: result.list_complete ? undefined : result.cursor,
        listComplete: result.list_complete,
      };
    },
  };
}

export function createNoopKeyValueCacheAdapter(
  kind: "noop" = "noop"
): KeyValueCacheAdapter {
  return {
    kind,
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
    async list() {
      return { keys: [], listComplete: true };
    },
  };
}

function r2ObjectToStoredObject(object: R2ObjectBody): StoredObject {
  return {
    body: object.body,
    size: object.size,
    etag: object.etag,
    contentType: object.httpMetadata?.contentType,
  };
}

export function createCloudflareRuntimePlatform(
  env: PlatformBindingEnv,
  options?: { publicCache?: CloudflareCacheLike | null }
): RuntimePlatform {
  const database: SqlDatabaseAdapter | null = env.DB
    ? ({
        kind: "d1",
        prepare(query: string) {
          return env.DB.prepare(query) as unknown as SqlPreparedStatement;
        },
        async batch(statements: SqlPreparedStatement[]) {
          return (await env.DB.batch(
            statements as unknown as D1PreparedStatement[]
          )) as unknown as SqlResult<Record<string, unknown>>[];
        },
      } as unknown as SqlDatabaseAdapter)
    : null;

  const objectStorage: ObjectStorageAdapter | null = env.ASSETS_BUCKET
    ? {
        kind: "r2",
        async get(key) {
          const object = await env.ASSETS_BUCKET?.get(key);
          return object ? r2ObjectToStoredObject(object) : null;
        },
        async put(key, value, options) {
          await env.ASSETS_BUCKET?.put(key, value, {
            httpMetadata: {
              contentType: options?.contentType,
              cacheControl: options?.cacheControl,
            },
            customMetadata: options?.metadata,
          });
        },
        async delete(key) {
          await env.ASSETS_BUCKET?.delete(key);
        },
        async list(options) {
          const listed = await env.ASSETS_BUCKET?.list({
            prefix: options?.prefix,
            limit: options?.limit,
          });
          return (
            listed?.objects.map((object) => ({
              key: object.key,
              size: object.size,
              uploaded: object.uploaded,
            })) ?? []
          );
        },
      }
    : null;

  const imageTransformer: ImageTransformerAdapter | null = env.IMAGES
    ? {
        kind: "cloudflare-images",
        async transform(body, options) {
          const result = await env.IMAGES.input(body)
            .transform(options.width ? { width: options.width } : {})
            .output({
              format: options.format,
              quality: options.quality,
            });
          return {
            body: result.image(),
            contentType: result.contentType(),
            response: () => result.response(),
          };
        },
      }
    : null;

  const keyValueCache: KeyValueCacheAdapter | null = env.CONTENT_CACHE
    ? createCloudflareKeyValueCacheAdapter(env.CONTENT_CACHE)
    : null;

  return {
    id: "cloudflare-workers",
    database,
    objectStorage,
    imageTransformer,
    keyValueCache,
    publicCache: options?.publicCache
      ? createCloudflarePublicCacheAdapter(options.publicCache)
      : null,
  };
}
