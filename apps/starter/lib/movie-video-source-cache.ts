import type { NotionFileSource } from "./notion/types";
import { getDatabase } from "./platform/current";

const DEFAULT_TTL_MS = 1000 * 60 * 50;
const REFRESH_SKEW_MS = 1000 * 60 * 5;

type CachedMovieVideoSourceRow = {
  block_id: string;
  source_type: "file" | "external";
  url: string;
  expiry_time: string | null;
  content_type: string | null;
  refreshed_at: string;
  last_error: string | null;
};

export type CachedMovieVideoSource = NotionFileSource & {
  contentType: string | null;
  refreshedAt: string;
};

function isFresh(row: CachedMovieVideoSourceRow, now = new Date()) {
  if (!row.url) return false;
  if (!row.expiry_time) {
    const refreshedAt = new Date(
      `${row.refreshed_at.replace(" ", "T")}Z`
    ).getTime();
    return Number.isFinite(refreshedAt) && now.getTime() - refreshedAt < DEFAULT_TTL_MS;
  }

  const expiry = new Date(row.expiry_time).getTime();
  return Number.isFinite(expiry) && expiry - now.getTime() > REFRESH_SKEW_MS;
}

function rowToSource(row: CachedMovieVideoSourceRow): CachedMovieVideoSource {
  if (row.source_type === "external") {
    return {
      type: "external",
      url: row.url,
      contentType: row.content_type,
      refreshedAt: row.refreshed_at,
    };
  }

  return {
    type: "file",
    url: row.url,
    expiryTime: row.expiry_time,
    contentType: row.content_type,
    refreshedAt: row.refreshed_at,
  };
}

export async function getCachedMovieVideoSource(
  blockId: string
): Promise<CachedMovieVideoSource | null> {
  const row = await getDatabase().prepare(
    `SELECT block_id, source_type, url, expiry_time, content_type, refreshed_at, last_error
       FROM movie_video_sources
      WHERE block_id = ?
      LIMIT 1`
  )
    .bind(blockId)
    .first<CachedMovieVideoSourceRow>();

  if (!row || !isFresh(row)) return null;
  return rowToSource(row);
}

export async function setCachedMovieVideoSource(input: {
  blockId: string;
  source: NotionFileSource;
  contentType?: string | null;
}) {
  await getDatabase().prepare(
    `INSERT INTO movie_video_sources (
       block_id, source_type, url, expiry_time, content_type, refreshed_at, last_error
     )
     VALUES (?, ?, ?, ?, ?, datetime('now'), NULL)
     ON CONFLICT(block_id) DO UPDATE SET
       source_type = excluded.source_type,
       url = excluded.url,
       expiry_time = excluded.expiry_time,
       content_type = excluded.content_type,
       refreshed_at = datetime('now'),
       last_error = NULL`
  )
    .bind(
      input.blockId,
      input.source.type,
      input.source.url,
      input.source.type === "file" ? input.source.expiryTime : null,
      input.contentType ?? null
    )
    .run();
}

export async function noteMovieVideoSourceRefreshError(input: {
  blockId: string;
  error: unknown;
}) {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error);
  await getDatabase().prepare(
    `UPDATE movie_video_sources
        SET refreshed_at = datetime('now'),
            last_error = ?
      WHERE block_id = ?`
  )
    .bind(message.slice(0, 500), input.blockId)
    .run();
}
