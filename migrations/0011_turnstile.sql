-- Turnstile widget site key (public). Secret stays in TURNSTILE_SECRET_KEY env binding.

ALTER TABLE app_settings ADD COLUMN turnstile_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN turnstile_site_key TEXT;
ALTER TABLE app_settings ADD COLUMN turnstile_updated_at TEXT;
