// Internal admin module — exposed only through the
// `@nextion/core/internal-admin` subpath for the starter's
// backward-compat shims. Not part of the public API surface; can
// change at any time.

export {
  DEFAULT_ADMIN_EMAIL,
  ensureAdminUser,
  isAdminEmail,
  normalizeEmail,
} from "./admin";
export {
  getAppSettings,
  getGoogleOAuthConfig,
  getTurnstilePublicConfig,
  updateTurnstileConfig,
  disableTurnstileConfig,
  updateGoogleOAuthConfig,
  clearGoogleOAuthConfig,
  updateSiteTitle,
} from "./settings";
export type { AppSettings } from "./settings";
export {
  buildTurnstilePublicConfig,
  DEFAULT_TURNSTILE_PUBLIC_CONFIG,
  isSchemaDriftError,
  runSchemaHealthChecks,
} from "./schema-guard";
