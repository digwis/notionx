import { NextResponse } from "next/server";
import { getAuthViewer } from "@/lib/auth";
import {
  fileObjectForMediaBlock,
  isDirectVideoUrl,
  normalizeNotionFileSource,
} from "@/lib/notion/media";
import { refreshNotionMovieVideoSource } from "@/lib/notion/movie-video-source";
import { getPublicNotionMovieByRouteId } from "@/lib/notion/movies";
import { canStreamMovieVideo } from "@/lib/movie-video-access";
import { verifyMovieVideoPlaybackToken } from "@/lib/movie-video-playback-token";
import {
  getCachedMovieVideoSource,
  noteMovieVideoSourceRefreshError,
  setCachedMovieVideoSource,
} from "@/lib/movie-video-source-cache";
import type { NotionBlock, NotionFileSource } from "@/lib/notion/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; blockId: string }>;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function findBlockById(blocks: NotionBlock[], blockId: string): NotionBlock | null {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    if (block.children?.length) {
      const child = findBlockById(block.children, blockId);
      if (child) return child;
    }
  }

  return null;
}

function redirectToMedia(url: string) {
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function inferVideoContentType(url: string, contentType: string | null) {
  const value = String(contentType ?? "").trim().toLowerCase();
  if (value && value !== "application/octet-stream") return contentType;

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".mp4") || pathname.endsWith(".m4v")) {
      return "video/mp4";
    }
    if (pathname.endsWith(".webm")) return "video/webm";
    if (pathname.endsWith(".mov")) return "video/quicktime";
  } catch {
    // Keep the upstream content type when the signed URL cannot be parsed.
  }

  return contentType;
}

async function fetchUpstreamMedia(url: string, request: Request, head: boolean) {
  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "*/*",
  });
  const range = request.headers.get("range");
  const ifRange = request.headers.get("if-range");
  if (range) {
    headers.set("Range", range);
  }
  if (ifRange) headers.set("If-Range", ifRange);

  if (!head) return fetch(url, { headers });

  const upstream = await fetch(url, { method: "HEAD", headers });
  if (upstream.ok || upstream.status === 206 || upstream.status === 416) {
    return upstream;
  }

  if (!range) headers.set("Range", "bytes=0-0");
  return fetch(url, { headers });
}

async function proxyMedia(url: string, request: Request, head = false) {
  const upstream = await fetchUpstreamMedia(url, request, head);
  const canReturnWithoutBody = head || upstream.status === 416;
  if (
    (!upstream.ok && upstream.status !== 416) ||
    (!upstream.body && !canReturnWithoutBody)
  ) {
    return jsonResponse(
      { ok: false, reason: "upstream_unavailable" },
      { status: upstream.status || 502 }
    );
  }

  const responseHeaders = new Headers();
  const contentType = inferVideoContentType(
    url,
    upstream.headers.get("content-type")
  );
  for (const header of [
    "accept-ranges",
    "content-encoding",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }
  if (!responseHeaders.has("accept-ranges")) {
    responseHeaders.set("accept-ranges", "bytes");
  }
  if (contentType) responseHeaders.set("content-type", contentType);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Referrer-Policy", "no-referrer");

  return new Response(head ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

async function sourceForStreaming(
  block: NotionBlock,
  blockId: string
): Promise<NotionFileSource | null> {
  const source = normalizeNotionFileSource(fileObjectForMediaBlock(block));
  if (source?.type !== "file") return source;

  const cached = await getCachedMovieVideoSource(blockId);
  if (cached) return cached;

  try {
    const freshSource = await refreshNotionMovieVideoSource(blockId);
    if (!freshSource) return source;
    await setCachedMovieVideoSource({ blockId, source: freshSource });
    return freshSource;
  } catch (error) {
    await noteMovieVideoSourceRefreshError({ blockId, error });
    console.error(
      JSON.stringify({
        tag: "movie_video_stream_error",
        operation: "refresh_notion_block",
        blockId,
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return source;
  }
}

async function handleStream(request: Request, { params }: Props, head = false) {
  const viewer = await getAuthViewer();
  if (!viewer) {
    return jsonResponse(
      { ok: false, reason: "unauthenticated" },
      { status: 401 }
    );
  }

  const { id, blockId } = await params;
  const movie = await getPublicNotionMovieByRouteId(id);
  if (!movie) {
    return jsonResponse({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const allowed = await canStreamMovieVideo({
    userId: viewer.user?.uid ?? 0,
    isVip: viewer.canViewVipContent,
    movieId: movie.routeId,
    blockId,
  });
  if (!allowed) {
    return jsonResponse({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const tokenOk = await verifyMovieVideoPlaybackToken({
    token: new URL(request.url).searchParams.get("t"),
    viewer,
    movieId: movie.routeId,
    blockId,
  });
  if (!tokenOk) {
    return jsonResponse({ ok: false, reason: "invalid_token" }, { status: 403 });
  }

  const block = findBlockById(movie.blocks, blockId);
  if (!block || block.type !== "video") {
    return jsonResponse({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const source = await sourceForStreaming(block, blockId);
  if (!source) {
    return jsonResponse({ ok: false, reason: "not_found" }, { status: 404 });
  }

  if (source.type === "external" && !isDirectVideoUrl(source.url)) {
    return redirectToMedia(source.url);
  }

  return proxyMedia(source.url, request, head);
}

export async function GET(request: Request, props: Props) {
  return handleStream(request, props);
}

export async function HEAD(request: Request, props: Props) {
  return handleStream(request, props, true);
}
