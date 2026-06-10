-- users 表：Google OAuth 登录的用户
-- 与 admin 密码并行存在：两个都进得去 admin
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  google_sub TEXT UNIQUE,         -- Google 用户的 unique id
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
