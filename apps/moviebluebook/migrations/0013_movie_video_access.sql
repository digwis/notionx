-- Free movie video allowance for non-VIP users.
-- One row means a user has unlocked one movie video block for the period.

CREATE TABLE IF NOT EXISTS movie_video_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  movie_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  period TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, movie_id, block_id, period)
);

CREATE INDEX IF NOT EXISTS idx_movie_video_access_user_period
  ON movie_video_access(user_id, period);

CREATE INDEX IF NOT EXISTS idx_movie_video_access_lookup
  ON movie_video_access(user_id, movie_id, block_id, period);
