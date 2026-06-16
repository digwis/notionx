// packages/nextion/src/platform/current.ts
//
// Single entry point for runtime platform accessors.
//
// Previously split across `current.ts` (the public façade) and
// `cloudflare-runtime.ts` (the Cloudflare implementation), with
// `getDatabase` / `getPublicCache` duplicated in both. The two
// files are merged here so there is one authoritative copy of
// each accessor.

import { workerEnv } from "../util/env";
import { currentRuntimeId } from "./selection";
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
  const platform = getRuntimePlatform();
  const database = platform.database;
  if (!database) {
    throw new Error(`SQL database adapter not configured for ${platform.id}`);
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

export function getKeyValueCache() {
  return getRuntimePlatform().keyValueCache;
}

export const runtimeSelection = {
  currentRuntimeId,
};
