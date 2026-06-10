export const REQUIRED_SCHEMA_CHECKS = [
  {
    key: "app_settings.turnstile_enabled",
    sql: "SELECT turnstile_enabled FROM app_settings LIMIT 1",
  },
  {
    key: "users.session_rev",
    sql: "SELECT session_rev FROM users LIMIT 1",
  },
  {
    key: "auth_rate_limits",
    sql: "SELECT 1 FROM auth_rate_limits LIMIT 1",
  },
];

export const DEFAULT_TURNSTILE_PUBLIC_CONFIG = {
  enabled: false,
  siteKey: null,
  secretConfigured: false,
};

export function isSchemaDriftError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("no such column") || message.includes("no such table")
  );
}

export function buildTurnstilePublicConfig(
  settings: { turnstile_enabled: number; turnstile_site_key: string | null },
  envLike: { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string }
): { enabled: boolean; siteKey: string | null; secretConfigured: boolean } {
  const envSiteKey = envLike.TURNSTILE_SITE_KEY?.trim() || null;
  const siteKey = settings.turnstile_site_key?.trim() || envSiteKey || null;
  const secretConfigured = Boolean(envLike.TURNSTILE_SECRET_KEY?.trim());
  const enabled =
    (settings.turnstile_enabled === 1 || Boolean(envSiteKey)) &&
    Boolean(siteKey) &&
    secretConfigured;

  return {
    enabled,
    siteKey,
    secretConfigured,
  };
}

export async function runSchemaHealthChecks(db: {
  prepare: (sql: string) => { first: () => Promise<unknown> };
}): Promise<{ ok: boolean; missing: string[]; errors: string[] }> {
  const missing: string[] = [];
  const errors: string[] = [];

  for (const check of REQUIRED_SCHEMA_CHECKS) {
    try {
      await db.prepare(check.sql).first();
    } catch (error) {
      if (isSchemaDriftError(error)) {
        missing.push(check.key);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${check.key}: ${message}`);
      }
    }
  }

  return {
    ok: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}
