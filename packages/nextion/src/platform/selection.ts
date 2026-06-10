export type RuntimeId = "cloudflare-workers";

export type RuntimeKind = "cloudflare";

export interface RuntimeSelection {
  kind: RuntimeKind;
  runtimeId: RuntimeId;
}

function hasCloudflareBindings(env: unknown): boolean {
  if (!env || typeof env !== "object") return false;
  const record = env as Record<string, unknown>;
  return (
    "DB" in record ||
    "ASSETS_BUCKET" in record ||
    "R2" in record ||
    "IMAGES" in record ||
    "CONTENT_CACHE" in record
  );
}

export function selectRuntime(env: unknown): RuntimeSelection {
  if (hasCloudflareBindings(env)) {
    return { kind: "cloudflare", runtimeId: "cloudflare-workers" };
  }
  throw new Error(
    "No supported runtime detected. Expected Cloudflare Workers bindings " +
      "(DB, ASSETS_BUCKET, R2, IMAGES, or CONTENT_CACHE).",
  );
}

export function currentRuntimeId(): RuntimeId {
  return "cloudflare-workers";
}
