import { workerEnv } from "../util/env";
import {
  createCloudflarePublicCacheAdapter,
  createCloudflareRuntimePlatform,
} from "./runtime";

function getDefaultCloudflareCache() {
  const globalWithCaches = globalThis as typeof globalThis & {
    caches?: CacheStorage & { default?: Cache };
  };
  return globalWithCaches.caches?.default ?? null;
}

export function getRuntimePlatform() {
  return createCloudflareRuntimePlatform(workerEnv, {
    publicCache: getDefaultCloudflareCache(),
  });
}

export function getDatabase() {
  const database = getRuntimePlatform().database;
  if (!database) {
    throw new Error("SQL database binding not configured");
  }
  return database;
}

export function getPublicCache() {
  const cache = getDefaultCloudflareCache();
  if (!cache) {
    throw new Error("Cloudflare cache binding not configured");
  }
  return createCloudflarePublicCacheAdapter(cache);
}
