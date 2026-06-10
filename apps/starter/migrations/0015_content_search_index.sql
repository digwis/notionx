-- Generic search index for Notion-backed public content.
-- Stores flattened block text so list/API search can match article or movie body.

CREATE TABLE IF NOT EXISTS content_search_index (
  model_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  facets TEXT NOT NULL DEFAULT '[]',
  normalized_text TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT,
  indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (model_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_content_search_model_indexed
  ON content_search_index(model_id, indexed_at DESC);
