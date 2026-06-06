-- Session revocation, password reset, login rate limiting

ALTER TABLE users ADD COLUMN session_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN password_reset_token TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
  ON users(password_reset_token);

-- scope examples: login:email:user@example.com, forgot:email:user@example.com
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  scope TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
