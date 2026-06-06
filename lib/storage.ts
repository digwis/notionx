// lib/storage.ts - R2 文件上传 / 列出 / 删除 helpers
// 用法：env.ASSETS_BUCKET 是 wrangler.jsonc 里 r2_buckets.binding 的名字
//
// 文件命名：<随机UUID>.<ext>（防止覆盖 + 防盗链）
// 公网访问：暂时用 worker 自己的 /api/files/[key] 代理（避免公开 bucket 的复杂性）
// 如果想用公开 R2 bucket（更快）：把 bucket 设成 public，加 custom domain

import { workerEnv } from "./env";

export type UploadResult = {
  key: string;
  url: string;
  size: number;
  contentType: string;
};

function buildAssetUrl(kind: "cdn" | "files", key: string): string {
  // Encode each path segment separately so nested R2 keys remain routable.
  const safeKey = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/${kind}/${safeKey}`;
}

// 允许上传的文件类型（防止把 R2 当垃圾场）
// 注意：浏览器在某些情况下可能给空 type，这里除了 MIME 还允许通过扩展名判断。
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

// 100 MB 上限（worker 请求 body 限制）
const MAX_SIZE = 100 * 1024 * 1024;

export async function uploadFile(
  file: File,
  prefix = "uploads"
): Promise<UploadResult> {
  const env = workerEnv;
  if (!env.ASSETS_BUCKET) {
    throw new Error("R2 bucket binding not configured");
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`File too large: ${file.size} bytes (max ${MAX_SIZE})`);
  }
  // 双保险：MIME 命中 OR 扩展名命中
  if (!ALLOWED.has(file.type) && !ALLOWED_IMAGE_EXT.test(file.name)) {
    throw new Error(`Unsupported file type: ${file.type || "(empty)"}`);
  }

  // 随机 key（防猜测）
  const ext = file.name.split(".").pop() || "bin";
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const date = new Date().toISOString().slice(0, 10);
  const key = `${prefix}/${date}/${rand}.${ext}`;

  // 写入 R2（自带 content-type + immutable cache）
  await env.ASSETS_BUCKET.put(key, file, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      originalName: file.name.slice(0, 100),
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    key,
    // 图片走 cdn（自动 WebP/AVIF 优化），其他文件走 files
    url: file.type.startsWith("image/")
      ? buildAssetUrl("cdn", key)
      : buildAssetUrl("files", key),
    size: file.size,
    contentType: file.type,
  };
}

export async function deleteFile(key: string): Promise<void> {
  const env = workerEnv;
  if (!env.ASSETS_BUCKET) return;
  await env.ASSETS_BUCKET.delete(key);
}

export async function listFiles(prefix = "uploads", limit = 50) {
  const env = workerEnv;
  if (!env.ASSETS_BUCKET) return [];
  const listed = await env.ASSETS_BUCKET.list({ prefix, limit });
  return listed.objects.map((o: R2Object) => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded.toISOString(),
    url: buildAssetUrl("files", o.key),
  }));
}
