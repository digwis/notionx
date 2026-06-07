import { NextResponse } from "next/server";
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
  if (accept.includes("image/avif")) {
    outputFormat = "image/avif";
  } else if (accept.includes("image/webp")) {
    outputFormat = "image/webp";
  }

  if (isImage && !range && outputFormat && workerEnv.IMAGES) {
    try {
      const result = await workerEnv.IMAGES.input(upstream.body)
        .transform({ width })
        .output({ format: outputFormat, quality });

      return new Response(result.image(), {
        headers: {
          "Content-Type": outputFormat,
          "Cache-Control": cacheControl(request),
          Vary: "Accept",
          "X-Notion-Media-Branch": "transformed",
          "X-Optimized-Width": String(width),
          "X-Optimized-Quality": String(quality),
        },
      });
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

export async function GET(_request: Request, { params }: Props) {
  const { ref } = await params;
  if (ref.some((part) => part === ".." || part.includes("/"))) {
    return badRequest();
  }

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
