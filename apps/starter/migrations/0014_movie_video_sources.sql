-- Short-lived cache for Notion-hosted movie video signed URLs.
-- This avoids refreshing the Notion block on every browser Range request.

CREATE TABLE IF NOT EXISTS movie_video_sources (
  block_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  url TEXT NOT NULL,
  expiry_time TEXT,
  content_type TEXT,
  refreshed_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_movie_video_sources_expiry
  ON movie_video_sources(expiry_time);
