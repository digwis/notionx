import type { RuntimeId } from "./selection.ts";

export type RuntimeCapability =
  | "server-rendering"
  | "edge-cache"
  | "relational-storage"
  | "object-storage"
  | "image-optimization"
  | "secrets"
  | "observability";

export type RuntimeAdapterDefinition = {
  id: RuntimeId;
  label: string;
  status: "active" | "partial" | "planned";
  services: {
    compute: string;
    relationalStorage: string;
    objectStorage: string;
    imageOptimization: string;
    cache: string;
    authStorage: string;
  };
  capabilities: readonly RuntimeCapability[];
};

export type RuntimeServiceStatus = {
  database: boolean;
  objectStorage: boolean;
  imageTransformer: boolean;
  publicCache: boolean;
};

export const cloudflareWorkersAdapter: RuntimeAdapterDefinition = {
  id: "cloudflare-workers",
  label: "Cloudflare Workers + D1",
  status: "active",
  services: {
    compute: "Cloudflare Workers via vinext",
    relationalStorage: "D1 through the runtime SQL adapter",
    objectStorage: "R2",
    imageOptimization: "Cloudflare Images",
    cache: "vinext CDN/data adapters and caches.default for media",
    authStorage: "D1 users and signed cookies",
  },
  capabilities: [
    "server-rendering",
    "edge-cache",
    "relational-storage",
    "object-storage",
    "image-optimization",
    "secrets",
    "observability",
  ],
};

export const runtimeAdapters = [cloudflareWorkersAdapter] as const;

export function getRuntimeAdapter(id: RuntimeAdapterDefinition["id"]) {
  return runtimeAdapters.find((adapter) => adapter.id === id);
}

export function runtimeServiceStatus(
  platform: {
    database: unknown;
    objectStorage: unknown;
    imageTransformer: unknown;
    publicCache: unknown;
  }
): RuntimeServiceStatus {
  return {
    database: Boolean(platform.database),
    objectStorage: Boolean(platform.objectStorage),
    imageTransformer: Boolean(platform.imageTransformer),
    publicCache: Boolean(platform.publicCache),
  };
}
