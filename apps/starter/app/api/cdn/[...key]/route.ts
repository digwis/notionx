// GET /api/cdn/[...key] - 从对象存储取原图，调用运行时图片转换转 WebP/AVIF 后返回
//
// 用 catch-all 参数兼容两种 URL：
// 1. /api/cdn/uploads/2026-06-06/file.jpg
// 2. /api/cdn/uploads%2F2026-06-06%2Ffile.jpg

import { NextResponse } from "next/server";
import {
  type StoredObject,
} from "@/lib/platform/runtime";
import { getRuntimePlatform } from "@/lib/platform/current";

export const dynamic = "force-dynamic";

const DEFAULT_WIDTH = 1200;
const MAX_WIDTH = 2400;
const DEFAULT_QUALITY = 75;
const MIN_QUALITY = 40;
const MAX_QUALITY = 85;

type Props = {
  params: Promise<{ key: string[] }>;
};

function decodeKey(parts: string[]): string {
  return decodeURIComponent(parts.join("/"));
}

function clampInt(
  value: string | null,
  min: number,
  max: number,
  fallback: number
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

export async function GET(request: Request, { params }: Props) {
  const { key } = await params;
  const decoded = decodeKey(key);
  const url = new URL(request.url);

  if (decoded.includes("..") || decoded.startsWith("/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const platform = getRuntimePlatform();
  const storage = platform.objectStorage;
  if (!storage) {
    return NextResponse.json(
      { error: "Object storage not configured" },
      { status: 503 }
    );
  }

  const object = await storage.get(decoded);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accept = request.headers.get("accept") ?? "";
  const isImage = object.contentType?.startsWith("image/") ?? false;

  if (!isImage) {
    return streamObject(object, {
      "X-Debug-Cdn-Branch": "non-image",
      "X-Debug-Cdn-Key": decoded,
    });
  }

  let outputFormat: "image/avif" | "image/webp" | null = null;
  let outputQuality: number | undefined = undefined;

  if (accept.includes("image/avif")) {
    outputFormat = "image/avif";
    outputQuality = 60;
  } else if (accept.includes("image/webp")) {
    outputFormat = "image/webp";
    outputQuality = 75;
  }

  const isSvg = object.contentType === "image/svg+xml";
  if (!outputFormat || isSvg || !platform.imageTransformer) {
    return streamObject(object, {
      "X-Debug-Cdn-Branch": isSvg
        ? "svg-bypass"
        : !platform.imageTransformer
          ? "transformer-bypass"
          : "format-bypass",
      "X-Debug-Cdn-Accept": accept.includes("image/avif")
        ? "avif"
        : accept.includes("image/webp")
          ? "webp"
          : "other",
      "X-Debug-Cdn-Key": decoded,
    });
  }

  try {
    // #region debug-point B:cdn-transform-branch
    const width = clampInt(url.searchParams.get("w"), 64, MAX_WIDTH, DEFAULT_WIDTH);
    const quality = clampInt(
      url.searchParams.get("q"),
      MIN_QUALITY,
      MAX_QUALITY,
      outputQuality ?? DEFAULT_QUALITY
    );

    const result = await platform.imageTransformer.transform(object.body, {
      width,
      format: outputFormat,
      quality,
    });

    return new Response(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        Vary: "Accept",
        "X-Debug-Cdn-Branch": "transformed",
        "X-Debug-Cdn-Key": decoded,
        "X-Optimized-Width": String(width),
        "X-Optimized-Quality": String(quality),
        "X-Original-Format": object.contentType ?? "unknown",
        "X-Optimized-Format": outputFormat,
      },
    });
    // #endregion
  } catch (e) {
    return streamObject(object, {
      "X-Debug-Cdn-Branch": "transform-error-fallback",
      "X-Debug-Cdn-Key": decoded,
      "X-Debug-Cdn-Error": e instanceof Error ? e.name : "unknown",
    });
  }
}

function streamObject(
  object: StoredObject,
  extraHeaders?: Record<string, string>
): Response {
  const headers = new Headers();
  if (object.contentType) {
    headers.set("Content-Type", object.contentType);
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Length", String(object.size));
  if (object.etag) headers.set("ETag", object.etag);
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    headers.set(key, value);
  }
  return new Response(object.body, { headers });
}
