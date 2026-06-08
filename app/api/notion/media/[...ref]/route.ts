import { NextResponse } from "next/server";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import {
  notionMediaR2KeyForUrl,
  publicMediaCacheKeyForUrl,
  publicMediaVariantForAccept,
  type PublicMediaVariant,
} from "@/lib/cache-keys";
import { createNotionClient } from "@/lib/notion/client";
import { workerEnv } from "@/lib/env";
import { getNotionClientConfig } from "@/lib/notion/config";
import {
  fileObjectForMediaBlock,
  normalizeNotionFileSource,
  pickFirstFilesPropertyValue,
} from "@/lib/notion/media";
import type { NotionBlock, NotionPageLike } from "@/lib/notion/types";

export const dynamic = "force-dynamic";

const DEFAULT_WIDTH = 1200;
const MAX_WIDTH = 2400;
const DEFAULT_QUALITY = 75;
const MIN_QUALITY = 40;
const MAX_QUALITY = 85;
const CACHEABLE_STATUS = new Set([200]);

type Props = {
  params: Promise<{ ref: string[] }>;
};

function clampInt(
  value: string | null,
  min: number,
  max: number,
  fallback: number
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function cacheControl(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has("v")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
}

function canUseMediaCache(request: Request) {
  if (request.method !== "GET") return false;
  return !request.headers.has("range");
}

function mediaCacheHeaders(
  response: Response,
  request: Request,
  state: "HIT" | "MISS" | "BYPASS",
  r2State?: "HIT" | "MISS" | "BYPASS"
) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl(request));
  headers.set("X-Notion-Media-Cache", state);
  if (r2State) headers.set("X-Notion-Media-R2", r2State);
  return headers;
}

async function responseFromR2Cache(
  request: Request,
  variant: PublicMediaVariant
) {
  const url = new URL(request.url);
  const r2Key = notionMediaR2KeyForUrl(url, variant);
  if (!r2Key || !workerEnv.ASSETS_BUCKET) return null;

  const object = await workerEnv.ASSETS_BUCKET.get(r2Key);
  if (!object?.body) return null;

  const contentType =
    object.httpMetadata?.contentType ??
    (variant === "avif" ? "image/avif" : "image/webp");
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", cacheControl(request));
  headers.set("Vary", "Accept");
  headers.set("X-Notion-Media-Branch", "r2");
  headers.set("X-Notion-Media-R2", "HIT");
  if (object.etag) headers.set("ETag", object.etag);

  return new Response(object.body, { headers });
}

async function withEdgeMediaCache(
  request: Request,
  variant: PublicMediaVariant,
  load: () => Promise<Response>
) {
  if (!canUseMediaCache(request)) {
    const response = await load();
    return new Response(response.body, {
      status: response.status,
      headers: mediaCacheHeaders(response, request, "BYPASS"),
    });
  }

  const cache = (caches as CacheStorage & { default: Cache }).default;
  const url = new URL(request.url);
  const cacheKey = new Request(publicMediaCacheKeyForUrl(url, variant), {
    method: "GET",
  });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: mediaCacheHeaders(cached, request, "HIT"),
    });
  }

  const r2Response = await responseFromR2Cache(request, variant);
  const response = r2Response ?? (await load());
  const headers = mediaCacheHeaders(response, request, "MISS");
  const output = new Response(response.body, {
    status: response.status,
    headers,
  });

  if (CACHEABLE_STATUS.has(response.status)) {
    const toCache = output.clone();
    getRequestExecutionContext()?.waitUntil(cache.put(cacheKey, toCache));
  }

  return output;
}

function mediaRedirect(url: string) {
  const response = NextResponse.redirect(url, 302);
  response.headers.set(
    "Cache-Control",
    "public, max-age=300, s-maxage=300, stale-while-revalidate=300"
  );
  return response;
}

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function badRequest() {
  return NextResponse.json({ error: "Invalid media ref" }, { status: 400 });
}

async function serveFileObject(
  input: unknown,
  request: Request,
  options?: { redirectNotionHosted?: boolean }
) {
  const source = normalizeNotionFileSource(input);
  if (!source) return notFound();
  if (source.type === "external") return mediaRedirect(source.url);
  if (options?.redirectNotionHosted) return mediaRedirect(source.url);
  return proxyNotionHostedFile(source.url, request);
}

async function proxyNotionHostedFile(url: string, request: Request) {
  const range = request.headers.get("range");
  const ifRange = request.headers.get("if-range");
  const upstreamHeaders = new Headers({
    Accept: request.headers.get("accept") ?? "*/*",
  });
  if (range) upstreamHeaders.set("Range", range);
  if (ifRange) upstreamHeaders.set("If-Range", ifRange);

  const upstream = await fetch(url, {
    headers: upstreamHeaders,
  });
  if ((!upstream.ok && upstream.status !== 416) || !upstream.body) {
    return NextResponse.json(
      { error: "Unable to fetch Notion media" },
      { status: upstream.status || 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const isImage = contentType.startsWith("image/");
  const accept = request.headers.get("accept") ?? "";
  const variant = publicMediaVariantForAccept(accept);
  const urlObj = new URL(request.url);
  const width = clampInt(
    urlObj.searchParams.get("w"),
    64,
    MAX_WIDTH,
    DEFAULT_WIDTH
  );
  const quality = clampInt(
    urlObj.searchParams.get("q"),
    MIN_QUALITY,
    MAX_QUALITY,
    DEFAULT_QUALITY
  );

  let outputFormat: "image/avif" | "image/webp" | null = null;
  if (variant === "avif") {
    outputFormat = "image/avif";
  } else if (variant === "webp") {
    outputFormat = "image/webp";
  }

  if (isImage && !range && outputFormat && workerEnv.IMAGES) {
    const r2Key = notionMediaR2KeyForUrl(urlObj, variant);

    try {
      const result = await workerEnv.IMAGES.input(upstream.body)
        .transform({ width })
        .output({ format: outputFormat, quality });
      const transformed = result.response();
      const headers = new Headers(transformed.headers);
      headers.set("Content-Type", result.contentType());
      headers.set("Cache-Control", cacheControl(request));
      headers.set("Vary", "Accept");
      headers.set("X-Notion-Media-Branch", "transformed");
      headers.set("X-Notion-Media-R2", r2Key ? "MISS" : "BYPASS");
      headers.set("X-Optimized-Width", String(width));
      headers.set("X-Optimized-Quality", String(quality));

      if (transformed.body && r2Key && workerEnv.ASSETS_BUCKET) {
        const [clientBody, r2Body] = transformed.body.tee();
        getRequestExecutionContext()?.waitUntil(
          workerEnv.ASSETS_BUCKET.put(r2Key, r2Body, {
            httpMetadata: {
              contentType: result.contentType(),
              cacheControl: "public, max-age=31536000, immutable",
            },
            customMetadata: {
              source: "notion",
              cachedAt: new Date().toISOString(),
              width: String(width),
              quality: String(quality),
            },
          })
        );

        return new Response(clientBody, { headers });
      }

      return new Response(transformed.body, { headers });
    } catch {
      // Fall through to the original file when the image binding cannot transform.
    }
  }

  const headers = new Headers();
  for (const header of [
    "accept-ranges",
    "content-disposition",
    "content-encoding",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }
  if (contentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Cache-Control", cacheControl(request));
  headers.set("X-Notion-Media-Branch", "proxied");
  return new Response(upstream.body, { status: upstream.status, headers });
}

async function loadMedia(_request: Request, ref: string[]) {
  const client = createNotionClient(await getNotionClientConfig());

  if (ref[0] === "page" && ref[1] && ref[2] === "cover") {
    const page = (await client.pages.retrieve({
      page_id: ref[1],
    })) as NotionPageLike;
    return serveFileObject(page.cover, _request);
  }

  if (ref[0] === "page" && ref[1] && ref[2] === "property" && ref[3]) {
    const page = (await client.pages.retrieve({
      page_id: ref[1],
    })) as NotionPageLike;
    const propertyName = decodeURIComponent(ref.slice(3).join("/"));
    return serveFileObject(
      pickFirstFilesPropertyValue(page.properties?.[propertyName]),
      _request
    );
  }

  if (ref[0] === "block" && ref[1]) {
    const block = (await client.blocks.retrieve({
      block_id: ref[1],
    })) as NotionBlock;
    return serveFileObject(fileObjectForMediaBlock(block), _request, {
      redirectNotionHosted:
        block.type === "video" ||
        block.type === "audio" ||
        block.type === "pdf" ||
        block.type === "file",
    });
  }

  return badRequest();
}

export async function GET(_request: Request, { params }: Props) {
  const { ref } = await params;
  if (ref.some((part) => part === ".." || part.includes("/"))) {
    return badRequest();
  }

  const variant = publicMediaVariantForAccept(
    _request.headers.get("accept") ?? ""
  );
  return withEdgeMediaCache(_request, variant, () => loadMedia(_request, ref));
}
