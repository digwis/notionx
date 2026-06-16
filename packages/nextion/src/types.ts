// Public type surface. Populated incrementally across phases 1–6.

// ----- Auth -----
// Phases 3+ replace this `unknown` placeholder with the real `AuthConfig`
// shape consumed by `createAuth`. Other tiers will continue to add their
// own types as their phases land.

/**
 * Names of the D1 tables that back the auth feature. Snake_case keys here
 * mirror the migration SQL; consumers do not need to redefine them.
 */
export interface AuthTables {
  users: string;
  sessions: string;
  passwordResets: string;
  emailVerifications: string;
  authRateLimits: string;
}

export interface AuthSessionCookieConfig {
  name: string;
  maxAge: number;
  secure: boolean;
}

export interface AuthRolesConfig {
  default: string;
  vip: string;
  admin: string;
}

export interface AuthTurnstileConfig {
  siteKeyEnv: string;
  secretKeyEnv: string;
}

export interface AuthEmailConfig {
  provider: "resend" | "smtp" | "none";
  fromEnv: string;
  apiKeyEnv: string;
}

export interface AuthOAuthGoogleConfig {
  clientIdEnv: string;
  clientSecretEnv: string;
}

export interface AuthOAuthConfig {
  google: AuthOAuthGoogleConfig;
}

export interface AuthPasswordConfig {
  minLength: number;
}

/**
 * Configuration object passed to `createAuth`. Decouples the auth helpers
 * from module-level state — the runtime resolves the database binding and
 * environment variables through this object.
 */
export interface AuthConfig {
  databaseBinding: string;
  tables: AuthTables;
  sessionCookie: AuthSessionCookieConfig;
  roles: AuthRolesConfig;
  turnstile?: AuthTurnstileConfig;
  email?: AuthEmailConfig;
  oauth?: AuthOAuthConfig;
  password?: AuthPasswordConfig;
}

// ----- Content -----
export type {
  ContentModelDefinition,
  ContentSource,
} from "./content/models";

// ----- Admin / Worker -----
/**
 * A single entry in the admin sidebar nav. `labelKey` is resolved at
 * render time against the i18n message catalog; `icon` is the lucide
 * icon name; `requireRole` is an optional guard so an item disappears
 * for viewers who do not have the named role.
 */
export interface AdminNavItem {
  href: string;
  labelKey: string;
  icon?: string;
  order?: number;
  requireRole?: string;
  external?: boolean;
}
