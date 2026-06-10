import { NextResponse } from "next/server";
import { getAuthViewer } from "@/lib/auth";
import {
  fileObjectForMediaBlock,
  isDirectVideoUrl,
  normalizeNotionFileSource,
  videoEmbedUrl,
} from "@/lib/notion/media";
import { refreshNotionMovieVideoSource } from "@/lib/notion/movie-video-source";
import { getPublicNotionMovieByRouteId } from "@/lib/notion/movies";
import { unlockMovieVideo } from "@/lib/movie-video-access";
import { createMovieVideoPlaybackToken } from "@/lib/movie-video-playback-token";
import {
  noteMovieVideoSourceRefreshError,
  setCachedMovieVideoSource,
} from "@/lib/movie-video-source-cache";
import type { NotionBlock } from "@/lib/notion/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; blockId: string }>;
};

type Playback = {
  type: "video" | "embed";
  src: string;
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

function streamUrl(movieId: string, blockId: string, token: string) {
  const params = new URLSearchParams({ t: token });
  return `/api/movies/${encodeURIComponent(movieId)}/video/${encodeURIComponent(blockId)}/stream?${params}`;
}

function playbackForSource(
  source: NonNullable<ReturnType<typeof normalizeNotionFileSource>>,
  movieId: string,
  blockId: string,
  token: string
): Playback {
  const stream = streamUrl(movieId, blockId, token);
  if (source.type === "file") return { type: "video", src: stream };

  const embed = videoEmbedUrl(source.url);
  if (embed) return { type: "embed", src: embed };
  if (isDirectVideoUrl(source.url)) return { type: "video", src: stream };
  return { type: "embed", src: source.url };
}

export async function GET(_request: Request, { params }: Props) {
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

  const block = findBlockById(movie.blocks, blockId);
  if (!block || block.type !== "video") {
    return jsonResponse({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const source = normalizeNotionFileSource(fileObjectForMediaBlock(block));
  if (!source) {
    return jsonResponse({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const state = await unlockMovieVideo({
    userId: viewer.user?.uid ?? 0,
    isVip: viewer.canViewVipContent,
    movieId: movie.routeId,
    blockId,
  });

  if (!state.ok) {
    return jsonResponse(
      {
        ok: false,
        reason: state.reason,
        limit: state.limit,
        used: state.used,
        remaining: state.remaining,
      },
      { status: 403 }
    );
  }

  const token = await createMovieVideoPlaybackToken({
    viewer,
    movieId: movie.routeId,
    blockId,
  });
  const stream = streamUrl(movie.routeId, blockId, token);
  const playback = playbackForSource(source, movie.routeId, blockId, token);

  if (source.type === "file") {
    try {
      const freshSource = await refreshNotionMovieVideoSource(blockId);
      if (freshSource) {
        await setCachedMovieVideoSource({ blockId, source: freshSource });
      }
    } catch (error) {
      await noteMovieVideoSourceRefreshError({ blockId, error });
      console.error(
        JSON.stringify({
          tag: "movie_video_source_error",
          operation: "refresh_on_unlock",
          blockId,
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  } else {
    await setCachedMovieVideoSource({ blockId, source });
  }

  return jsonResponse({
    ok: true,
    src: stream,
    playback,
    access: {
      vip: state.vip,
      limit: state.limit,
      used: state.used,
      remaining: state.remaining,
    },
  });
}
