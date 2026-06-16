// packages/create-notionx-app/src/render.ts
//
// File renderer for `create-notionx-app`. Walks the `src/templates/`
// directory, copies static files verbatim, and renders `.tmpl` files
// with simple `{{token}}` interpolation. The token map is derived
// from the prompt answers.

import { promises as fs } from "node:fs";
import path from "node:path";
import { siteComponentNames, siteDependencyEntries } from "./presets.js";
import type { Answers } from "./prompt.js";
import { hashPasswordForScaffold } from "./provision/password-hash.js";
import {
  buildInitialRegistryManifest,
  writeRegistryManifest,
} from "./registry/registry-store.js";
import { buildMultiSourceTokenMap } from "./registry/render-multi-source.js";
import { toCamel, toKebab, toPascal } from "./registry/text-utils.js";
import { uiComponents } from "./ui-presets.js";

interface TokenMap {
  projectName: string;
  projectNameLower: string;
  targetDir: string;
  defaultLocale: string;
  supportedLocales: string;
  supportedLocalesJson: string;
  notionxSource: string;
  createNotionxAppVersion: string;
  contentSourceId: string;
  contentSourceTitle: string;
  contentSourceKind: string;
  contentSourceListPath: string;
  contentSourceDetailPath: string;
  contentSourceApiPath: string;
  contentSourceFields: string;
  contentSourceNavLabel: string;
  contentSourcePluralName: string;
  contentSourceListTitle: string;
  contentSourceListDescription: string;
  contentSourceEmptyState: string;
  contentSourceRichBlocks: string;
  contentSourceCoverImages: string;
  contentSourceVarName: string;
  contentSourceConstName: string;
  fieldList: string;
  adminEmail: string;
  adminName: string;
  adminPasswordHash: string;
  // --- v2 multi-source tokens (consumed by `models.ts.tmpl`) ---
  /** Pre-rendered `defineContentSource({...})` block, one per installed content source. */
  contentSourceDeclarations: string;
  /** Comma-joined list of `*Source` variable names for every installed content source. */
  contentSourceSourcesVarNames: string;
  /**
   * Pre-rendered `defineContentSource({...})` block for internal
   * singleton sources (`siteSettingsSource`, `blocksSource`). Empty
   * string when neither is enabled.
   */
  internalSourceDeclarations: string;
  /**
   * Pre-rendered `export const *TranslationsSource` declarations for
   * the four translation data sources. All `null` when bilingual
   * mode is disabled.
   */
  translationSourceDeclarations: string;
  /**
   * Comma-joined list of internal `*Source` variable names. Empty
   * string when no internal sources are enabled.
   */
  internalSourceVarNames: string;
  /**
   * Rendered JSON fragment that lands inside the generated
   * `package.json`'s `dependencies` block. Already comma-trailed
   * and indented so it can sit between `{` and `}` without further
   * post-processing.
   */
  dependenciesBlock: string;
  /**
   * Plain list of UI components vendored for this preset, used by
   * the README's "What's included" section.
   */
  uiComponentList: string;
  /** Raw component name list — used by the per-preset file filter. */
  uiComponents: readonly string[];
}

/** Local-part of an email, used as the default display name. */
function localPart(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

async function buildTokenMap(
  answers: Answers,
  scaffoldVersion: string
): Promise<TokenMap> {
  const id = answers.contentSource.id;
  const isBlog = id === "blog";
  // Build the field map block that the generated `defineContentSource`
  // call interpolates. Indent every key/value so the call stays
  // readable inside the `fields: { ... }` object literal.
  const fieldMapLines = answers.contentSource.fields.map((f) => {
    const key = f.key;
    const notionName = JSON.stringify(f.notionName);
    return `      ${key}: ${notionName},`;
  });
  const fieldMapBlock = fieldMapLines.join("\n");

  // Hash the admin password with the same algorithm that
  // `@notionx/core`'s `hashPassword` uses, so the generated
  // `0002_admin_seed.sql` produces a row that `verifyPassword` can
  // check on first login. 100k PBKDF2 iterations takes ~200ms on
  // modern hardware — visible in the spinner, worth the wait.
  const adminPasswordHash = await hashPasswordForScaffold(
    answers.adminPassword
  );
  const uiComponentNames = uiComponents();

  return {
    projectName: answers.projectName,
    projectNameLower: answers.projectName.toLowerCase(),
    targetDir: answers.targetDir,
    defaultLocale: answers.defaultLocale,
    supportedLocales: answers.supportedLocales.join(", "),
    supportedLocalesJson: JSON.stringify(answers.supportedLocales),
    notionxSource: answers.notionxSource,
    createNotionxAppVersion: `^${scaffoldVersion}`,
    contentSourceId: id,
    contentSourceTitle: answers.contentSource.title,
    contentSourceKind: '"article"',
    contentSourceListPath: `/${id}`,
    contentSourceDetailPath: `/${id}/[slug]`,
    contentSourceApiPath: `/api/${id}`,
    contentSourceFields: fieldMapBlock,
    contentSourceVarName: `${toCamel(id)}Source`,
    contentSourceConstName: `${toCamel(id)}ContentModel`,
    contentSourceNavLabel: answers.contentSource.title,
    contentSourcePluralName: `${answers.contentSource.title}s`,
    contentSourceListTitle: answers.contentSource.title,
    contentSourceListDescription: isBlog
      ? "Blog posts backed by Notion metadata and page body content."
      : `${answers.contentSource.title} entries backed by Notion.`,
    contentSourceEmptyState: isBlog
      ? "No blog posts published yet."
      : `No ${answers.contentSource.title.toLowerCase()} entries yet.`,
    contentSourceRichBlocks: isBlog ? "true" : "false",
    contentSourceCoverImages: isBlog ? "true" : "false",
    fieldList: answers.contentSource.fields.map((f) => f.key).join(", "),
    adminEmail: answers.adminEmail,
    adminName: localPart(answers.adminEmail),
    adminPasswordHash,
    dependenciesBlock: buildDependenciesBlock(answers.notionxSource),
    uiComponentList: uiComponentNames.map((name: string) => `\`${name}\``).join(", "),
    uiComponents: uiComponentNames,
    // Multi-source tokens: the scaffold flow always describes exactly
    // one content source (the "first" one), so we synthesise a
    // single-item InstalledItem list and delegate to the multi-source
    // builder. `notionx add` will call `buildMultiSourceTokenMap`
    // directly with the project's full installed list.
    //
    // The `MultiSourceTokenMap` returns `contentSourceSourcesBlock`
    // (the full `defineContentSource` block). The legacy
    // `contentSourceSourcesVarNames` token (used by the
    // `contentSources = [...]` array) is derived from the
    // comma-joined variable names embedded in that block.
    ...((): {
      contentSourceDeclarations: string;
      contentSourceSourcesVarNames: string;
      internalSourceDeclarations: string;
      internalSourceVarNames: string;
      translationSourceDeclarations: string;
    } => {
      const multi = buildMultiSourceTokenMap({
        project: {
          projectName: answers.projectName,
          targetDir: answers.targetDir,
          defaultLocale: answers.defaultLocale,
          supportedLocales: answers.supportedLocales,
          notionxSource: answers.notionxSource,
          adminEmail: answers.adminEmail,
          adminPassword: answers.adminPassword,
          scaffoldVersion,
          bilingual: answers.supportedLocales.length > 1,
        },
        installed: [
          {
            id: answers.contentSource.id,
            kind: "content-source",
            version: 1,
            source: { kind: "official", name: "@notionx/official" },
            params: {
              contentSourceId: answers.contentSource.id,
              ...(isBlog ? {} : { basePath: `/${answers.contentSource.id}` }),
            },
            installedAt: new Date(0).toISOString(),
          },
        ],
        internalSources: {
          siteSettings: answers.enableSiteSettings,
          blocks: answers.enableBlocks,
        },
      });
      return {
        contentSourceDeclarations: multi.contentSourceDeclarations,
        contentSourceSourcesVarNames: multi.contentSourceSourcesVarNames,
        internalSourceDeclarations: multi.internalSourceDeclarations,
        internalSourceVarNames: multi.internalSourceVarNames,
        translationSourceDeclarations: multi.translationSourceDeclarations,
      };
    })(),
  };
}

/**
 * Build the `dependencies` block that goes into the generated
 * `package.json`. The block is a JSON-style object body (4-space
 * indent, no trailing comma) so it can be dropped between `{` and
 * `}` in the template.
 *
 * The base dependency set is the union of every package the
 * rendered components need. It is augmented by the preset's
 * declared extras (e.g. `@radix-ui/react-accordion` for the
 * `site` preset), filtered against the base set so we never emit
 * duplicate keys.
 */
function buildDependenciesBlock(notionxSource: string): string {
  // The base dependency set — every project needs these regardless
  // of which UI components it vendors. Keep this list stable: it is
  // the floor of every generated project.
  const baseDependencies: ReadonlyArray<readonly [string, string]> = [
    ["@notionx/core", notionxSource],
    ["class-variance-authority", "^0.7.1"],
    ["clsx", "^2.1.1"],
    ["lucide-react", "^0.460.0"],
    ["next", "16.2.7"],
    ["next-themes", "^0.4.4"],
    ["react", "^19.2.7"],
    ["react-dom", "^19.2.7"],
    ["tailwind-merge", "^2.5.5"],
    ["tailwindcss-animate", "^1.0.7"],
  ];

  // The base Radix packages the `site` preset's component files
  // need to compile (label, separator, slot are imported by the
  // vendored `button.tsx`, etc.). We seed the dependency block with
  // them so the scaffolder never emits a project that's missing a
  // Radix dep the components reference.
  const baseRadixDependencies: ReadonlyArray<readonly [string, string]> = [
    ["@radix-ui/react-label", "^2.1.0"],
    ["@radix-ui/react-separator", "^1.1.0"],
    ["@radix-ui/react-slot", "^1.2.0"],
  ];

  const presetExtras = siteDependencyEntries(
    new Set([
      // Anything in the base blocks is already covered — drop it
      // from the preset's contribution to avoid emitting the same
      // key twice in the JSON object.
      ...baseDependencies.map(([name]) => name),
      ...baseRadixDependencies.map(([name]) => name),
    ])
  );

  // Merge into a single dedup'd map. Preset extras win on conflict
  // (e.g. a future site preset may pin a newer Radix version than
  // the base set), so they go in last.
  const merged = new Map<string, string>();
  for (const [name, version] of baseDependencies) merged.set(name, version);
  for (const [name, version] of baseRadixDependencies) {
    merged.set(name, version);
  }
  for (const dep of presetExtras) merged.set(dep.name, dep.version);

  // Render as a stable, alphabetised JSON object body. We keep
  // the 4-space indent and the no-trailing-comma convention so the
  // output is diff-friendly.
  const lines: string[] = [];
  const keys = [...merged.keys()].sort();
  for (const name of keys) {
    const version = merged.get(name)!;
    lines.push(`    "${name}": ${JSON.stringify(version)}`);
  }
  return lines.join(",\n");
}

function renderTemplate(input: string, tokens: TokenMap): string {
  return input.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (full, key: string) => {
    const value = (tokens as unknown as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
    return full;
  });
}

function templateUiComponentName(filePath: string): string | null {
  if (path.basename(path.dirname(filePath)) !== "ui") return null;
  const baseName = path.basename(filePath);
  if (!baseName.endsWith(".tsx.tmpl")) return null;
  return baseName.slice(0, -".tsx.tmpl".length);
}

function shouldSkipTemplate(filePath: string, tokens: TokenMap): boolean {
  const component = templateUiComponentName(filePath);
  return Boolean(component && !tokens.uiComponents.includes(component));
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function readPackageVersion(): Promise<string> {
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const raw = await fs.readFile(packageJsonUrl, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}

/**
 * Default three-layer file ownership for a freshly scaffolded
 * project.
 */
function buildDefaultManagedFiles(input: {
  contentSourceId: string;
  enableSiteSettings: boolean;
  enableBlocks: boolean;
  enableAuth: boolean;
  enableAdmin: boolean;
  enablePages: boolean;
  enableSearch: boolean;
}): {
  platform: string[];
  bridge: string[];
  user: string[];
} {
  const userOwned = [
    "app/page.tsx",
    "components/site/site-header.tsx",
    "components/site/site-footer.tsx",
    "lib/content/models.ts",
  ];

  if (input.contentSourceId === "blog") {
    userOwned.push("app/blog/page.tsx", "app/blog/[slug]/page.tsx");
  }

  const bridgeOwned = ["worker/index.ts"];

  // Feature-module files: bridge-owned for the entry point,
  // user-owned for sub-components. Mirrors the ownership tags
  // declared in `registry-items.ts`.
  if (input.enableSiteSettings) {
    bridgeOwned.push("lib/site/settings.ts");
  }

  if (input.enableBlocks) {
    bridgeOwned.push("components/page-blocks.tsx");
    userOwned.push(
      "components/page-blocks/hero-block.tsx",
      "components/page-blocks/feature-grid-block.tsx",
      "components/page-blocks/story-block.tsx",
      "components/page-blocks/latest-posts-block.tsx",
    );
  }

  if (input.enableAuth) {
    bridgeOwned.push(
      "lib/auth.config.ts",
      "app/api/auth/google/route.ts",
      "app/api/auth/google/callback/route.ts",
      "app/api/auth/verify-email/route.ts",
      "app/api/auth/viewer/route.ts",
      "migrations/0001_init.sql",
    );
    userOwned.push("app/login/page.tsx", "app/register/page.tsx");
  }

  if (input.enableAdmin) {
    bridgeOwned.push(
      "app/admin/layout.tsx",
      "app/admin/page.tsx",
      "app/admin/loading.tsx",
      "app/admin/account/page.tsx",
      "app/admin/content-models/page.tsx",
      "lib/admin/nav.ts",
      "lib/admin/actions.ts",
      "lib/admin/context.tsx",
      "migrations/0002_admin_seed.sql",
    );
  }

  if (input.enablePages) {
    bridgeOwned.push(
      "lib/pages/model.ts",
      "lib/pages/source.ts",
      "app/[slug]/page.tsx",
    );
  }

  if (input.enableSearch) {
    bridgeOwned.push(
      "lib/search/config.ts",
      "migrations/0003_search_index.sql",
    );
    userOwned.push("components/search/search-dialog.tsx");
  }

  return {
    platform: [
      "package.json",
      "wrangler.jsonc",
      "next.config.ts",
      ".dev.vars.example",
    ],
    bridge: bridgeOwned,
    user: userOwned,
  };
}

export async function resolveTemplatesDir(): Promise<string> {
  const compiled = path.resolve(import.meta.dirname, "templates");
  const fromSource = path.resolve(import.meta.dirname, "..", "src", "templates");
  return (await exists(compiled)) ? compiled : fromSource;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

/**
 * Render the project. `templatesDir` is the absolute path to
 * `src/templates/` inside the scaffolder package; `outDir` is the
 * target directory the user picked in the prompt (relative or
 * absolute). Existing directories are not removed — the caller is
 * responsible for picking a clean target.
 */
export async function render(
  answers: Answers,
  templatesDir: string,
  outDir: string
): Promise<void> {
  const scaffoldVersion = await readPackageVersion();
  const tokens = await buildTokenMap(answers, scaffoldVersion);
  const absoluteOut = path.resolve(process.cwd(), outDir);

  if (await exists(absoluteOut)) {
    const entries = await fs.readdir(absoluteOut);
    if (entries.length > 0) {
      throw new Error(
        `Target directory ${absoluteOut} is not empty. Pick an empty path.`
      );
    }
  }

  await ensureDir(absoluteOut);

  // Build the initial v2 registry manifest. This is the single
  // source of truth for the project's state.
  const managedFiles = buildDefaultManagedFiles({
    contentSourceId: answers.contentSource.id,
    enableSiteSettings: answers.enableSiteSettings,
    enableBlocks: answers.enableBlocks,
    enableAuth: answers.enableAuth,
    enableAdmin: answers.enableAdmin,
    enablePages: answers.enablePages,
    enableSearch: answers.enableSearch,
  });
  const manifest = buildInitialRegistryManifest({
    projectName: answers.projectName,
    scaffoldVersion,
    notionxCore: answers.notionxSource,
    defaultLocale: answers.defaultLocale,
    supportedLocales: answers.supportedLocales,
    enableSiteSettings: answers.enableSiteSettings,
    enableBlocks: answers.enableBlocks,
    enableAuth: answers.enableAuth,
    enableAdmin: answers.enableAdmin,
    enablePages: answers.enablePages,
    enableSearch: answers.enableSearch,
    contentSource: {
      id: answers.contentSource.id,
      title: answers.contentSource.title,
      fields: answers.contentSource.fields.map((f) => ({
        key: f.key,
        notionName: f.notionName,
      })),
    },
    managedFiles,
  });
  await writeRegistryManifest(absoluteOut, manifest);

  // Feature flags drive the fallback-template selection: when a
  // flag is false, the Notion-backed version is skipped and the
  // `.fallback.ts.tmpl` variant is rendered in its place (so the
  // output filename is unchanged).
  const featureFlags = {
    siteSettings: answers.enableSiteSettings,
    blocks: answers.enableBlocks,
    auth: answers.enableAuth,
    admin: answers.enableAdmin,
    pages: answers.enablePages,
    search: answers.enableSearch,
  };

  // Walk templates/ — every file is either a `.tmpl` (interpolated and
  // written without the `.tmpl` suffix) or a literal copy.
  const entries = await fs.readdir(templatesDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(templatesDir, entry.name);
    if (entry.isDirectory()) {
      const dest = path.join(absoluteOut, entry.name);
      await copyDirWithRender(from, dest, tokens, featureFlags);
    } else if (entry.isFile()) {
      if (shouldSkipTemplate(from, tokens)) continue;
      if (shouldSkipFeatureTemplate(from, featureFlags)) continue;
      await writeFileWithRender(from, absoluteOut, tokens);
    }
  }
}

/**
 * Feature-gated template skip rules. When a feature is disabled, the
 * Notion-backed `.tmpl` is skipped so the `.fallback.ts.tmpl` variant
 * (rendered to the same output filename) takes its place. The
 * `page-blocks/` subdirectory is also skipped entirely when blocks
 * are disabled — the fallback `page-blocks.tsx` is a no-op that
 * doesn't need the sub-components.
 */
function shouldSkipFeatureTemplate(
  filePath: string,
  flags: FeatureFlags,
): boolean {
  const normalized = filePath.split(path.sep).join("/");
  if (!flags.siteSettings && normalized.endsWith("lib/site/settings.ts.tmpl")) {
    return true;
  }
  if (!flags.blocks && normalized.endsWith("components/page-blocks.tsx.tmpl")) {
    return true;
  }
  // Skip the entire `components/page-blocks/` subdirectory contents
  // when blocks are disabled. The fallback `page-blocks.tsx` doesn't
  // import any of the sub-components.
  if (!flags.blocks && normalized.includes("/components/page-blocks/")) {
    return true;
  }
  // Auth: skip the Notion-backed auth config and auth API routes
  // when auth is disabled. The fallback `auth.config.ts` is a no-op
  // stub, and the auth route handlers are omitted entirely.
  if (!flags.auth && normalized.endsWith("lib/auth.config.ts.tmpl")) {
    return true;
  }
  if (!flags.auth && normalized.includes("/app/api/auth/")) {
    return true;
  }
  if (!flags.auth && normalized.includes("/app/login/")) {
    return true;
  }
  if (!flags.auth && normalized.includes("/app/register/")) {
    return true;
  }
  // Skip the auth D1 migration (users/sessions/rate-limits tables)
  // when auth is disabled.
  if (!flags.auth && normalized.endsWith("migrations/0001_init.sql.tmpl")) {
    return true;
  }
  // Admin: skip the entire admin tree when admin is disabled.
  if (!flags.admin && normalized.includes("/app/admin/")) {
    return true;
  }
  if (!flags.admin && normalized.includes("/lib/admin/")) {
    return true;
  }
  // Skip the admin seed migration when admin is disabled.
  if (!flags.admin && normalized.endsWith("migrations/0002_admin_seed.sql.tmpl")) {
    return true;
  }
  // Pages: skip the pages lib and dynamic slug routes when pages
  // is disabled. The fallback `app/page.tsx` renders a static home.
  if (!flags.pages && normalized.includes("/lib/pages/")) {
    return true;
  }
  if (!flags.pages && normalized.includes("/app/[slug]/")) {
    return true;
  }
  if (!flags.pages && normalized.endsWith("app/page.tsx.tmpl")) {
    return true;
  }
  // Search: skip the Notion-backed search config and the search
  // index migration when search is disabled. The fallback
  // `lib/search/config.ts` is a no-op stub exporting `undefined`.
  if (!flags.search && normalized.endsWith("lib/search/config.ts.tmpl")) {
    return true;
  }
  if (!flags.search && normalized.includes("/components/search/")) {
    return true;
  }
  if (!flags.search && normalized.endsWith("migrations/0003_search_index.sql.tmpl")) {
    return true;
  }
  return false;
}

/**
 * The set of feature flags that control conditional template
 * rendering. Each flag mirrors a field on `RegistryManifest`.
 */
interface FeatureFlags {
  siteSettings: boolean;
  blocks: boolean;
  auth: boolean;
  admin: boolean;
  pages: boolean;
  search: boolean;
}

async function copyDirWithRender(
  src: string,
  dest: string,
  tokens: TokenMap,
  featureFlags: FeatureFlags,
): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    if (entry.isDirectory()) {
      // Directory names may also contain tokens (e.g. the blog page
      // lives at `app/{{contentSourceListPath}}/page.tsx.tmpl` so
      // the directory itself must be rendered to `/blog` at scaffold
      // time). Falling through to a literal name would produce an
      // invalid `{{contentSourceListPath}}` folder in the project.
      const renderedName = renderTemplate(entry.name, tokens);
      await copyDirWithRender(
        from,
        path.join(dest, renderedName),
        tokens,
        featureFlags,
      );
    } else if (entry.isFile()) {
      // Per-preset component filter: the `components/ui/` tree in
      // the templates directory carries the *union* of every preset
      // (so we only have to maintain one copy of each shadcn
      // component). At copy time, drop files that the active preset
      // didn't opt into. Since 0.5.4 only the `site` preset
      // survives, so this filter is equivalent to "copy all shadcn
      // components" — kept here so a future preset addition can
      // slot in without touching the renderer.
      if (isUiDirectory(src) && !shouldCopyUiComponent(entry.name)) {
        continue;
      }
      if (shouldSkipFeatureTemplate(from, featureFlags)) continue;
      await writeFileWithRender(from, dest, tokens);
    }
  }
}

/**
 * True when `dir` is the `components/ui/` directory of the
 * templates tree. Used to gate the per-preset component filter
 * (see `copyDirWithRender`).
 */
function isUiDirectory(dir: string): boolean {
  const parts = dir.split(path.sep);
  return (
    parts.length >= 2 &&
    parts[parts.length - 1] === "ui" &&
    parts[parts.length - 2] === "components"
  );
}

/**
 * Decide whether a `components/ui/<file>.tsx.tmpl` should be
 * copied for the given preset. The file list is the union across
 * all presets, and the preset's `components` array declares which
 * ones survive.
 *
 * Files that aren't `.tsx.tmpl` shadcn component copies (e.g. a
 * future `index.ts` helper or a barrel) are always copied — only
 * the named shadcn components participate in the filter.
 */
function shouldCopyUiComponent(
  fileName: string,
): boolean {
  if (!fileName.endsWith(".tsx.tmpl")) return true;
  const base = fileName.slice(0, -".tsx.tmpl".length);
  const allowed = new Set(siteComponentNames());
  return allowed.has(base);
}

async function writeFileWithRender(
  from: string,
  toDir: string,
  tokens: TokenMap
): Promise<void> {
  const baseName = path.basename(from);
  // `.fallback.ts.tmpl` / `.fallback.tsx.tmpl` variants render to
  // the same output filename as their Notion-backed counterpart
  // (i.e. `settings.fallback.ts.tmpl` → `settings.ts`). The
  // `.fallback.` segment is stripped in addition to `.tmpl`.
  const isFallbackTmpl = baseName.includes(".fallback.");
  const isTmpl = baseName.endsWith(".tmpl");
  let outName: string;
  if (isTmpl) {
    outName = isFallbackTmpl
      ? baseName.replace(/\.fallback\.(ts|tsx)\.tmpl$/, ".$1")
      : baseName.slice(0, -".tmpl".length);
  } else {
    outName = baseName;
  }
  const outPath = path.join(toDir, outName);

  if (isTmpl) {
    const raw = await fs.readFile(from, "utf8");
    const rendered = renderTemplate(raw, tokens);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, rendered, "utf8");
  } else {
    await ensureDir(path.dirname(outPath));
    await fs.copyFile(from, outPath);
  }
}
