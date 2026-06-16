// packages/create-nextion-app/src/registry/registry-types.ts
//
// v2 Registry Protocol types — the single source of truth for everything
// a project has installed, what version, from which registry, and how
// to migrate when those things change.
//
// Design notes:
// - This file has **no runtime dependencies** on Node APIs or other
//   modules in the package, so it can be imported from anywhere
//   (including the compiled `dist/`) without pulling in fs/path/etc.
// - All shapes are JSON-serializable. The `registry.json` file is
//   written verbatim from a `RegistryManifest`.

/**
 * Schema URL baked into `registry.json` so future readers can detect
 * "this manifest uses an older or newer protocol version".
 */
export const REGISTRY_SCHEMA_V2 =
  "https://notionx.dev/schemas/registry.v2.json" as const;

/**
 * Where a `RegistryItem` came from. Resolved at install time; not
 * editable by the user.
 */
export type RegistrySourceRef =
  | { kind: "official"; name: string } // e.g. "@notionx/official"
  | { kind: "url"; url: string } // e.g. https://acme.com/registry.json
  | { kind: "git"; repo: string; ref?: string } // e.g. github.com/team/reg
  | { kind: "local"; path: string }; // file:./.notionx/local-registry.json

/**
 * Three classes of "ability" a project can have. Mirrors Astro's
 * integration kinds and Angular's schematic scopes.
 */
export type RegistryItemKind =
  | "content-source" // a notion-backed content domain (blog/docs/movies)
  | "feature-module" // a cross-cutting feature (search/rss/seo)
  | "platform-extension"; // a runtime replacement (auth strategy, admin page)

/**
 * Three-layer file ownership. The platform layer is fully managed
 * by notionx (overwritten on update); bridge files are regenerated
 * from templates but may be touched by the user; user files are
 * never overwritten once installed.
 */
export type FileOwnership = "platform" | "bridge" | "user";

/**
 * A file contributed by a `RegistryItem`. `template` is a path inside
 * the registry's template tree; `content` is an inline override used
 * when the registry ships a tiny stub inline (e.g. a content-registry
 * bridge file that needs to know the user's installed items).
 */
export interface RegistryFile {
  path: string;
  ownership: FileOwnership;
  template?: string;
  content?: string;
  /**
   * For feature-module items only: the fallback template to render
   * when the item is *uninstalled*. The fallback file takes over the
   * same `path` so downstream importers keep compiling. Ignored for
   * content-source / platform-extension items.
   */
  fallbackTemplate?: string;
  /** Optional: when set, `notionx remove` will keep this file by default. */
  retainOnRemove?: boolean;
}

/**
 * Capabilities a `RegistryItem` exposes once installed. Used by:
 * - `notionx add` to wire up the worker / admin nav
 * - `notionx doctor` to validate env vars and bindings
 * - `notionx diff` to print a human-readable summary
 */
export interface RegistryCapabilities {
  publicRoutes?: string[];
  adminRoutes?: string[];
  apiRoutes?: string[];
  envVars?: string[];
  notionDataSources?: string[]; // e.g. ["NOTION_BLOG_DATA_SOURCE_ID"]
  d1Tables?: string[]; // e.g. ["blog_authors"]
  contentSourceIds?: string[]; // ids contributed to the runtime registry
}

/**
 * A single migration step. Steps execute in the order they appear in
 * the `RegistryMigration.steps` array. Each step is a tagged union
 * so we can dispatch in `applyMigrationStep()`.
 */
export type MigrationStep =
  | { kind: "notion-field-add"; source: string; property: string; type: string }
  | { kind: "notion-field-rename"; source: string; from: string; to: string }
  | { kind: "notion-field-deprecate"; source: string; property: string; fallback?: string }
  | { kind: "d1-table-create"; name: string; sql: string }
  | { kind: "d1-table-alter"; name: string; sql: string }
  | { kind: "d1-migration-file"; file: string }
  | { kind: "ts-codemod"; file: string; transform: string }
  | { kind: "env-add"; name: string; default?: string; secret?: boolean }
  | { kind: "config-merge"; file: string; json: Record<string, unknown> };

/**
 * One migration: from `<id>@<fromVersion>` to `<id>@<toVersion>`.
 * `notionx update` picks the migration whose `from` matches the
 * currently installed version (or the closest chain in between).
 */
export interface RegistryMigration {
  from: string; // "<id>@<fromVersion>"
  to: string; // "<id>@<toVersion>"
  steps: MigrationStep[];
}

/**
 * Description of a single "ability" you can install. Lives in the
 * registry (e.g. `@notionx/official`) — **not** in the project.
 *
 * A project never edits this directly. The project holds
 * `InstalledItem` records (see `RegistryManifest.installed`) that
 * point at the latest `RegistryItem` they resolved.
 */
export interface RegistryItem {
  id: string;
  kind: RegistryItemKind;
  version: number;
  source: RegistrySourceRef;
  publishedAt: string; // ISO timestamp
  requires?: Array<{ id: string; version: string }>; // semver range
  supersedes?: Array<{ id: string; version: string }>;
  params: Record<string, string>;
  files: RegistryFile[];
  capabilities: RegistryCapabilities;
  migrations: RegistryMigration[];
  /**
   * For feature-module items only: the manifest flag this item
   * controls. When installed, the flag is set to `true`; when
   * uninstalled, set to `false`. Ignored for other kinds.
   */
  featureFlag?: FeatureFlag;
}

/**
 * The set of manifest-level boolean flags that a feature-module
 * item can control. Each flag corresponds to a field on
 * `RegistryManifest` and drives conditional rendering in
 * `render.ts` / `install.ts` / `uninstall.ts`.
 */
export type FeatureFlag =
  | "enableSiteSettings"
  | "enableBlocks"
  | "enableAuth"
  | "enableAdmin"
  | "enablePages"
  | "enableSearch";

/**
 * A `RegistryItem` as recorded inside a project's `registry.json`.
 * We snapshot the fields the project cares about so update planning
 * doesn't have to refetch the registry just to check "are we on the
 * latest version?".
 */
export interface InstalledItem {
  id: string;
  kind: RegistryItemKind;
  version: number;
  source: RegistrySourceRef;
  params: Record<string, string>;
  installedAt: string; // ISO timestamp
  installRecordSha?: string; // sha256 of the resolved RegistryItem JSON
  /**
   * Project-relative paths of all files rendered during install.
   * Used by `notionx remove --purge` to delete the exact file set
   * that was written. Optional for backward compatibility with
   * manifests created before this field existed.
   */
  files?: string[];
}

/**
 * The full contents of a project's `.notionx/registry.json`.
 *
 * This is the **single source of truth** for:
 *   - which abilities are installed
 *   - which registry they came from
 *   - what core runtime version this project targets
 *   - per-item file ownership (for `notionx update` risk classification)
 *   - the primary content source the user picked at scaffold time
 */
export interface RegistryManifest {
  $schema: typeof REGISTRY_SCHEMA_V2;
  projectKind: "notionx";
  projectName: string;
  scaffoldVersion: string;
  notionxCore: string; // semver range, e.g. "^2.0.0"
  defaultLocale: string;
  supportedLocales: string[];
  enableSiteSettings: boolean;
  /**
   * Whether the project ships the `blocks` internal singleton source
   * (backs `components/page-blocks`). Mirrors `enableSiteSettings` —
   * when false, `lib/content/models.ts` omits `blocksSource` and the
   * scaffolder renders a fallback `components/page-blocks.tsx`.
   */
  enableBlocks: boolean;
  /**
   * Whether the project ships the auth module (login/register routes,
   * D1 users table, session management). When false, the scaffolder
   * renders fallback stubs for `lib/auth.config.ts` and auth API routes.
   */
  enableAuth: boolean;
  /**
   * Whether the project ships the admin dashboard (`/admin/*`). Depends
   * on `enableAuth` — the admin layout has an auth gate. When false,
   * admin routes and `lib/admin/*` are omitted.
   */
  enableAdmin: boolean;
  /**
   * Whether the project ships the pages module (`lib/pages/*`, dynamic
   * slug routes). Depends on `enableBlocks` — page blocks resolution
   * uses `blocksSource`. When false, `app/page.tsx` renders a static
   * fallback and `app/[slug]` is omitted.
   */
  enablePages: boolean;
  /**
   * Whether the project ships the search module (`lib/search/config.ts`,
   * `/api/search` route, search UI). When false, the search adapter
   * is `undefined` and the worker does not register the search route.
   */
  enableSearch: boolean;
  /**
   * The "primary" content source — the one the user picked during
   * `create-notionx-app`. v2 supports multiple content sources via
   * `installed`, but the scaffold flow still needs to remember
   * which one was the original (for `notionx update` re-rendering
   * and for `provision` to know which Notion database to seed).
   */
  contentSource: {
    id: string;
    title: string;
    fields: Array<{ key: string; notionName: string }>;
  };
  compat: {
    /**
     * Compatibility marker for projects that need special handling.
     * Today only `"legacy-vinext"` is recognised — it marks projects
     * where `notionxCore` is `workspace:*` (e.g. during monorepo
     * development) so the update flow doesn't try to resolve a real
     * semver. Absent or `"v2-native"` means normal consumer mode.
     */
    mode: "v2-native" | "legacy-vinext" | string;
  };
  registries: Record<
    string,
    {
      url: string;
      lastSyncAt?: string;
    }
  >;
  installed: InstalledItem[];
  /**
   * Three-layer file ownership lists. `platform` files are
   * overwritten on update; `bridge` files are regenerated; `user`
   * files are never touched after install.
   */
  managedFiles: {
    platform: string[];
    bridge: string[];
    user: string[];
  };
  /**
   * Optional project-specific hints, never written or rewritten by
   * notionx itself. Survives `update` / `add` / `remove` runs.
   */
  extras?: Record<string, unknown>;
}

/**
 * Typed view of `RegistryManifest.managedFiles`. Exposed as its own
 * type so `update` planners and the doctor can destructure it
 * cleanly.
 */
export interface ManagedFilesSnapshot {
  platform: string[];
  bridge: string[];
  user: string[];
}

/**
 * Loader return type. Carries the manifest plus a typed view of
 * `manifest.managedFiles` for convenience.
 */
export interface LoadedRegistry {
  manifest: RegistryManifest;
  managedFiles: ManagedFilesSnapshot;
}
