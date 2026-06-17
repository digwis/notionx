// packages/create-notionx-app/src/registry/render-multi-source.ts
//
// Multi-source token-map builder. The v1 `render.ts` accepted a
// single `contentSource` answer and emitted one source's worth of
// tokens. With v2, a project can have *N* content sources installed
// (blog + docs + movies + …), and the templates need to render
// them as a single `contentSources` array.
//
// This module is the **only** place where multi-source text is
// generated. v1 callers go through the legacy single-source path in
// `render.ts`; v2 callers (`notionx add` / `notionx init`) build
// their token map here and pass it to a thin multi-source render
// function. The two paths share a `TokenMap` shape so the on-disk
// output is identical.

import type { InstalledItem } from "./registry-types.js";
import { toCamel, titleCase } from "./text-utils.js";

export interface MultiSourceProject {
  projectName: string;
  targetDir: string;
  defaultLocale: string;
  supportedLocales: readonly string[];
  notionxSource: string;
  adminEmail: string;
  adminPassword: string;
  scaffoldVersion: string;
}

/**
 * The token map consumed by `templates/`. Carries the per-source
 * tokens derived from the **first** (primary) content source plus
 * the multi-source block tokens used by `models.ts.tmpl`.
 *
 * Tokens that no template references have been removed; the kept
 * set is the exact union of tokens consumed by `.tmpl` files.
 */
export interface MultiSourceTokenMap {
  // --- per-source tokens (derived from the primary source) ---
  contentSourceId: string;
  contentSourceTitle: string;
  contentSourceListPath: string;
  contentSourceVarName: string;
  contentSourceConstName: string;
  contentSourceNavLabel: string;
  contentSourceListTitle: string;
  contentSourceListDescription: string;
  contentSourceEmptyState: string;
  // --- multi-source block tokens (consumed by models.ts.tmpl) ---
  /** Pre-rendered `defineContentSource({...})` block for every installed content source. */
  contentSourceDeclarations: string;
  /** Comma-joined list of `*Source` variable names (one per source). */
  contentSourceSourcesVarNames: string;
  /**
   * Pre-rendered `defineContentSource({...})` block for internal
   * singleton sources (`siteSettingsSource`, `blocksSource`) that
   * are currently enabled. Empty string when neither is enabled.
   */
  internalSourceDeclarations: string;
  /**
   * Comma-joined list of internal `*Source` variable names. Empty
   * string when no internal sources are enabled. Always includes a
   * leading newline+indent when non-empty so it sits cleanly on its
   * own line in the `managedContentSources` array.
   */
  internalSourceVarNames: string;
  /**
   * Pre-rendered `export const *TranslationsSource` declarations for
   * the four translation data sources. Empty string when bilingual
   * mode is disabled.
   */
  translationSourceDeclarations: string;
}

/**
 * Render the `export const *TranslationsSource` declarations for
 * the four translation data sources (`blog-translations`,
 * `page-translations`, `block-translations`,
 * `site-settings-translations`).
 *
 * When bilingual mode is disabled, all four are exported as `null`
 * so downstream imports don't break. When bilingual mode is enabled
 * but a specific translation source has no data-source ref yet, that
 * individual source is also `null`.
 */
function buildTranslationSourceDeclarations(
  input: {
    bilingual?: boolean;
  }
): string {
  if (!input.bilingual) {
    // When not bilingual, export all four as null so imports don't break.
    return [
      "export const blogTranslationsSource = null;",
      "export const pageTranslationsSource = null;",
      "export const blockTranslationsSource = null;",
      "export const siteSettingsTranslationsSource = null;",
    ].join("\n");
  }

  // When bilingual, declare all four translation sources with their
  // standard env var names. The actual data source ids are created
  // during provisioning and set as Cloudflare worker secrets / env
  // vars — the runtime reads them via `process.env[envVar]`.
  const decl = (
    varName: string,
    id: string,
    envVar: string,
    name: string,
    description: string
  ) => `export const ${varName} = defineContentSource({
  id: "${id}",
  kind: "directory",
  visibility: { public: false, admin: true },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "${envVar}",
    fields: { title: "Title", slug: "Slug", published: "Published" },
    query: { pageSize: 100 },
  },
  routes: {
    listPath: "/__internal/${id}",
    detailPath: "/__internal/${id}/[slug]",
    detailParam: "slug",
    publicApiPath: "/api/__internal/${id}",
  },
  ui: {
    name: "${name}",
    pluralName: "${name}",
    navLabel: "${name}",
    listTitle: "${name}",
    listDescription: "${description}",
    emptyState: "No translations yet.",
  },
  capabilities: { richBlocks: false, coverImages: false, gatedAssets: false },
});`;

  return [
    decl(
      "blogTranslationsSource",
      "blog-translations",
      "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
      "Blog Translations",
      "Locale-specific rows for blog posts."
    ),
    decl(
      "pageTranslationsSource",
      "page-translations",
      "NOTION_PAGES_TRANSLATIONS_DATA_SOURCE_ID",
      "Page Translations",
      "Locale-specific rows for site pages."
    ),
    decl(
      "blockTranslationsSource",
      "block-translations",
      "NOTION_BLOCKS_TRANSLATIONS_DATA_SOURCE_ID",
      "Block Translations",
      "Locale-specific rows for page blocks."
    ),
    decl(
      "siteSettingsTranslationsSource",
      "site-settings-translations",
      "NOTION_SITE_SETTINGS_TRANSLATIONS_DATA_SOURCE_ID",
      "Site Settings Translations",
      "Locale-specific rows for site settings."
    ),
  ].join("\n\n");
}

/**
 * Build a token map from a list of installed items.
 *
 * Sorting rule: content sources are alphabetised by `id` so the
 * generated `models.ts` is deterministic across runs (the order of
 * registration is observable via `getRegisteredSources()` and a
 * non-deterministic order would produce noisy diffs in
 * `notionx update` plans).
 *
 * Internal singleton sources (`siteSettingsSource`, `blocksSource`)
 * are emitted in a fixed order (site-settings first, then blocks)
 * so the generated block is also deterministic.
 */
export function buildMultiSourceTokenMap(input: {
  project: MultiSourceProject;
  installed: readonly InstalledItem[];
  /**
   * Which internal singleton sources to include in the generated
   * `models.ts`. Defaults to `{ siteSettings: true, blocks: true }`
   * to match the pre-refactor behaviour (both always present).
   */
  internalSources?: { siteSettings?: boolean; blocks?: boolean };
  /** When true, the token map includes translation source declarations. */
  bilingual?: boolean;
  /** Translation source refs (from scaffold metadata or provision result). */
  translationSources?: Record<
    string,
    { dataSourceId: string; envVar: string } | undefined
  >;
}): MultiSourceTokenMap {
  const contentSources = input.installed
    .filter((i) => i.kind === "content-source")
    .sort((a, b) => a.id.localeCompare(b.id));

  if (contentSources.length === 0) {
    throw new Error(
      "Cannot build a multi-source token map without at least one content-source item installed.",
    );
  }

  // Reject duplicate ids — they would shadow each other in the
  // runtime registry and produce a broken `models.ts`.
  const seen = new Set<string>();
  for (const source of contentSources) {
    if (seen.has(source.id)) {
      throw new Error(
        `Duplicate content-source id "${source.id}" in installed list. ` +
          `Each content source must have a unique id.`,
      );
    }
    seen.add(source.id);
  }

  const primary = contentSources[0]!;
  const sourcesBlock = renderSourcesBlock(contentSources);

  const internalFlags = {
    siteSettings: input.internalSources?.siteSettings ?? true,
    blocks: input.internalSources?.blocks ?? true,
  };
  const internalDecls: string[] = [];
  const internalVars: string[] = [];
  if (internalFlags.siteSettings) {
    internalDecls.push(SITE_SETTINGS_SOURCE_DECLARATION);
    internalVars.push("siteSettingsSource");
  }
  if (internalFlags.blocks) {
    internalDecls.push(BLOCKS_SOURCE_DECLARATION);
    internalVars.push("blocksSource");
  }

  return {
    contentSourceId: primary.id,
    contentSourceTitle: titleCase(primary.id),
    contentSourceListPath: `/${primary.id}`,
    contentSourceVarName: `${toCamel(primary.id)}Source`,
    contentSourceConstName: `${toCamel(primary.id)}ContentModel`,
    contentSourceNavLabel: titleCase(primary.id),
    contentSourceListTitle: titleCase(primary.id),
    contentSourceListDescription: `${titleCase(primary.id)} entries backed by Notion.`,
    contentSourceEmptyState: `No ${primary.id} entries yet.`,
    contentSourceDeclarations: sourcesBlock,
    contentSourceSourcesVarNames: varNamesForSources(contentSources),
    internalSourceDeclarations: internalDecls.join("\n\n"),
    internalSourceVarNames: internalVars.length
      ? "\n  " + internalVars.join(",\n  ") + ","
      : "",
    translationSourceDeclarations: buildTranslationSourceDeclarations(input),
  };
}

function varNamesForSources(
  sources: readonly { id: string }[],
): string {
  return sources
    .map((s) => `${toCamel(s.id)}Source`)
    .join(", ");
}

// ---- internals ----

/**
 * Render the `defineContentSource({...})` calls for every installed
 * content source, separated by `\n\n`. The output is meant to be
 * dropped into `models.ts` between the import block and the
 * `contentSources` array literal.
 */
function renderSourcesBlock(sources: readonly InstalledItem[]): string {
  return sources
    .map((source) => renderSingleSourceDeclaration(source))
    .join("\n\n");
}

function renderSingleSourceDeclaration(source: InstalledItem): string {
  const id = source.id;
  const camelId = toCamel(id);
  const varName = `${camelId}Source`;
  const listPath = pathForSource(source, "list");
  const detailPath = pathForSource(source, "detail");
  const apiPath = pathForSource(source, "api");
  const envVar = toEnvVarForSource(id);
  const kind = id === "blog" ? "article" : "catalog";
  const capabilities = defaultCapabilities(id);

  // Indent every `key: "value"` line so it sits inside `fields: { ... }`
  // of the generated call. Default fields: title + slug, which is the
  // minimum any Notion data source needs. Users edit the file to
  // match their actual property names.
  return [
    `export const ${varName}: ContentSource = defineContentSource({`,
    `  id: "${id}",`,
    `  kind: ${JSON.stringify(kind)},`,
    `  visibility: {`,
    `    public: true,`,
    `    admin: true,`,
    `  },`,
    `  source: {`,
    `    type: "notion",`,
    `    tokenEnv: "NOTION_TOKEN",`,
    `    dataSourceEnv: ${JSON.stringify(envVar)},`,
    `    fields: {`,
    `      title: "Name",`,
    `      slug: "Slug",`,
    `    },`,
    `    query: {`,
    `      pageSize: 50,`,
    `    },`,
    `  },`,
    `  routes: {`,
    `    listPath: ${JSON.stringify(listPath)},`,
    `    detailPath: ${JSON.stringify(detailPath)},`,
    `    detailParam: "slug",`,
    `    publicApiPath: ${JSON.stringify(apiPath)},`,
    `  },`,
    `  ui: {`,
    `    name: ${JSON.stringify(titleCase(id))},`,
    `    pluralName: ${JSON.stringify(`${titleCase(id)}s`)},`,
    `    navLabel: ${JSON.stringify(titleCase(id))},`,
    `    listTitle: ${JSON.stringify(titleCase(id))},`,
    `    listDescription: ${JSON.stringify(`${titleCase(id)} entries backed by Notion.`)},`,
    `    emptyState: ${JSON.stringify(`No ${id} entries yet.`)},`,
    `  },`,
    `  capabilities: ${capabilities},`,
    `});`,
  ].join("\n");
}

function pathForSource(
  source: InstalledItem,
  kind: "list" | "detail" | "api",
): string {
  // Sources can override the path via params (e.g. `basePath: "/docs"`).
  // Falls back to the convention `/{id}` and `/api/{id}`.
  const basePath = source.params.basePath;
  if (basePath && kind !== "api") {
    return kind === "list" ? basePath : `${basePath}/[slug]`;
  }
  switch (kind) {
    case "list":
      return `/${source.id}`;
    case "detail":
      return `/${source.id}/[slug]`;
    case "api":
      return `/api/${source.id}`;
  }
}

function toEnvVarForSource(id: string): string {
  return `NOTION_${snakeUpper(id)}_DATA_SOURCE_ID`;
}

function snakeUpper(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

function defaultCapabilities(id: string): string {
  // Blog ships with rich block rendering and cover images because
  // that's what the v1 starter assumed. Other sources default to
  // the leaner shape; users can edit the file to enable features.
  if (id === "blog") {
    return "{\n    richBlocks: true,\n    coverImages: true,\n    gatedAssets: false,\n  }";
  }
  return "{\n    richBlocks: false,\n    coverImages: true,\n    gatedAssets: false,\n  }";
}

// ---- internal singleton source declarations ----
//
// These two `defineContentSource({...})` blocks back
// `lib/site/settings.ts` and `components/page-blocks` respectively.
// They are emitted verbatim into `models.ts` between the
// `BEGIN generated-internal-sources` / `END generated-internal-sources`
// markers when the corresponding flag (`enableSiteSettings` /
// `enableBlocks`) is true.
//
// Keep these in sync with the field maps documented in
// `templates/README.md.tmpl` — operators edit the Notion database
// columns to match these names.

const SITE_SETTINGS_SOURCE_DECLARATION = `export const siteSettingsSource: ContentSource = defineContentSource({
  id: "site-settings",
  kind: "directory",
  visibility: {
    public: false,
    admin: true,
  },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_SITE_SETTINGS_DATA_SOURCE_ID",
    fields: {
      title: "Name",
      section: "Section",
      key: "Key",
      value: "Value",
      type: "Type",
      published: "Published",
    },
    query: {
      pageSize: 100,
    },
  },
  routes: {
    listPath: "/__internal/site-settings",
    detailPath: "/__internal/site-settings/[slug]",
    detailParam: "slug",
    publicApiPath: "/api/__internal/site-settings",
  },
  ui: {
    name: "Site Settings",
    pluralName: "Site Settings",
    navLabel: "Site Settings",
    listTitle: "Site Settings",
    listDescription:
      "Multi-row key-value table in Notion that powers the site name, tagline, description, SEO, navigation, theme, and footer. Each row is one setting item grouped by Section.",
    emptyState: "No site settings rows found — re-run provisioning.",
  },
  capabilities: {
    richBlocks: false,
    coverImages: false,
    gatedAssets: false,
  },
});`;

const BLOCKS_SOURCE_DECLARATION = `export const blocksSource: ContentSource = defineContentSource({
  id: "blocks",
  kind: "directory",
  visibility: {
    public: false,
    admin: true,
  },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_BLOCKS_DATA_SOURCE_ID",
    fields: {
      title: "Name",
      slug: "Slug",
      type: "Type",
      order: "Order",
      cover: "Cover",
      published: "Published",
    },
    query: {
      pageSize: 50,
    },
  },
  routes: {
    listPath: "/__internal/blocks",
    detailPath: "/__internal/blocks/[slug]",
    detailParam: "slug",
    publicApiPath: "/api/__internal/blocks",
  },
  ui: {
    name: "Block",
    pluralName: "Blocks",
    navLabel: "Blocks",
    listTitle: "Reusable Blocks",
    listDescription:
      "Reusable structured page sections stored in Notion. Content is written as Notion page body blocks — what you see is what you get.",
    emptyState: "No reusable blocks found — re-run provisioning.",
  },
  capabilities: {
    richBlocks: true,
    coverImages: true,
    gatedAssets: false,
  },
});`;
