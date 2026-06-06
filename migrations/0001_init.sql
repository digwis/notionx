-- Schema for the blog. Designed to mirror the previous in-memory Post shape.

CREATE TABLE IF NOT EXISTS posts (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  date        TEXT NOT NULL,                 -- ISO 8601 'YYYY-MM-DD'
  author      TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',    -- JSON array
  content     TEXT NOT NULL DEFAULT '[]'     -- JSON array of paragraphs
);

CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
