-- Email/password auth support for users
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verify_token TEXT;
ALTER TABLE users ADD COLUMN email_verify_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email_verify_token
  ON users(email_verify_token);
