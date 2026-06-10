import {
  getPublicCache as getCloudflarePublicCache,
  getRuntimePlatform as getCloudflareRuntimePlatform,
} from "./cloudflare-runtime";
import { currentRuntimeId } from "./selection";

export function getRuntimePlatform() {
  return getCloudflareRuntimePlatform();
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
  return getCloudflarePublicCache();
}

export function getKeyValueCache() {
  return getRuntimePlatform().keyValueCache;
}

export const runtimeSelection = {
  currentRuntimeId,
};
