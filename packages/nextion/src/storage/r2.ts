// Object storage helpers for file upload, list, and delete.
//
// Cloudflare Workers uses R2 as the backing store; the abstraction in
// platform/runtime.ts hides the concrete binding.
//
// File naming: <randomUUID>.<ext> — prevents collisions and makes keys
// non-guessable.
// Public access: today every read goes through the worker's
// /api/files/[key] proxy (avoids the complexity of a public bucket).
// To serve directly from R2: make the bucket public and attach a
// custom domain.

import { getRuntimePlatform } from "../platform/current";

export type UploadResult = {
  key: string;
  url: string;
  size: number;
  contentType: string;
};

export function buildAssetUrl(kind: "cdn" | "files", key: string): string {
  // Encode each path segment separately so nested R2 keys remain routable.
  const safeKey = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/${kind}/${safeKey}`;
}

// Whitelisted MIME types — keeps the bucket from becoming a dumping
// ground. The browser can occasionally send an empty type, so the
// extension is also checked.
const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  "application/pdf",
  "text/plain",
]);

const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)$/i;

// 100 MB cap (worker request body limit).
const MAX_SIZE = 100 * 1024 * 1024;

export async function uploadFile(
  file: File,
  prefix = "uploads"
): Promise<UploadResult> {
  const storage = getRuntimePlatform().objectStorage;
  if (!storage) {
    throw new Error("Object storage binding not configured");
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`File too large: ${file.size} bytes (max ${MAX_SIZE})`);
  }
  // Belt and suspenders: pass the MIME whitelist OR a matching extension.
  if (!ALLOWED.has(file.type) && !ALLOWED_IMAGE_EXT.test(file.name)) {
    throw new Error(`Unsupported file type: ${file.type || "(empty)"}`);
  }

  // Random key (non-guessable).
  const ext = file.name.split(".").pop() || "bin";
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const date = new Date().toISOString().slice(0, 10);
  const key = `${prefix}/${date}/${rand}.${ext}`;

  // Write to object storage with content-type and immutable cache headers.
  await storage.put(key, file, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000, immutable",
    metadata: {
      originalName: file.name.slice(0, 100),
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    key,
    // Images go through the CDN (auto WebP/AVIF optimization); other
    // files go through the raw /api/files proxy.
    url: file.type.startsWith("image/")
      ? buildAssetUrl("cdn", key)
      : buildAssetUrl("files", key),
    size: file.size,
    contentType: file.type,
  };
}

export async function deleteFile(key: string): Promise<void> {
  const storage = getRuntimePlatform().objectStorage;
  if (!storage) return;
  await storage.delete(key);
}

export async function listFiles(prefix = "uploads", limit = 50) {
  const storage = getRuntimePlatform().objectStorage;
  if (!storage) return [];
  const listed = await storage.list({ prefix, limit });
  return listed.map((object) => ({
    key: object.key,
    size: object.size,
    uploaded: object.uploaded.toISOString(),
    url: buildAssetUrl("files", object.key),
  }));
}
