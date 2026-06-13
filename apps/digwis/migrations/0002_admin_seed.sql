-- Bootstrap the admin user and link the configured admin_email to it.
-- Rendered by `@notionx/create-nextion-app` with the PBKDF2-SHA256
-- hash of the password collected at scaffold time. Idempotent: safe
-- to re-run via `wrangler d1 migrations apply`.

-- 1. Make sure the singleton `app_settings` row carries the admin
--    email that the auth helpers (`isAdminEmail`) consult.
UPDATE app_settings
   SET admin_email = 'zhaofilms@gmail.com',
       updated_at = datetime('now')
 WHERE id = 1;

-- 2. Insert (or refresh) the admin user. Re-runs are safe: the
--    `users.email` UNIQUE index makes the ON CONFLICT clause take
--    over and refresh the password hash + role instead of
--    duplicating. The role is hard-set to 'admin' so the user passes
--    role checks on the very first request.
INSERT INTO users (email, name, password_hash, email_verified, role)
  VALUES (
    'zhaofilms@gmail.com',
    'zhaofilms',
    'pbkdf2_sha256$100000$o9zETUhl9GSJM65D4fkCCw==$77uz/UhlLHCE/3GtccF5CIuo4k7XqxU0j9vMBQh7vyM=',
    1,
    'admin'
  )
  ON CONFLICT(email) DO UPDATE SET
    name           = excluded.name,
    password_hash  = excluded.password_hash,
    role           = 'admin',
    email_verified = 1;
