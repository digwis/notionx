// packages/notionx-cli/src/registry/registry-store.ts
//
// Read / write `.notionx/registry.json` atomically.
//
// Why atomic: a partial write would leave the project un-loadable on
// the next `notionx` command. We write to `<file>.tmp` first, then
// `rename` into place — `rename` is atomic on POSIX filesystems.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  REGISTRY_SCHEMA_V2,
  type InstalledItem,
  type RegistryManifest,
  type RegistrySourceRef,
} from "./registry-types.js";

/**
 * Canonical location of the v2 manifest, relative to a project root.
 * Kept as a constant so the CLI and the doctor agree on the path.
 */
export const REGISTRY_FILE = ".notionx/registry.json" as const;

/**
 * Read `registry.json` from `<projectDir>/.notionx/registry.json`.
 *
 * Returns `null` when the file does not exist. Throws on parse errors
 * or schema mismatches — we never want to silently load garbage.
 */
export async function readRegistryManifest(
  projectDir: string,
): Promise<RegistryManifest | null> {
  const filePath = path.join(projectDir, REGISTRY_FILE);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (isENOENT(err)) return null;
    throw err;
  }

  const parsed = JSON.parse(raw) as Partial<RegistryManifest>;
  if (parsed.$schema !== REGISTRY_SCHEMA_V2) {
    throw new Error(
      `Registry manifest at ${filePath} uses unknown schema "${parsed.$schema ?? "<missing>"}" (expected ${REGISTRY_SCHEMA_V2}).`,
    );
  }
  return parsed as RegistryManifest;
}

/**
 * Write the v2 manifest atomically.
 *
 * Strategy: write to `<file>.tmp` with `fsync` to make sure bytes hit
 * disk, then `rename` over the target. If anything fails before the
 * rename, the original `registry.json` (if any) is untouched.
 */
export async function writeRegistryManifest(
  projectDir: string,
  manifest: RegistryManifest,
): Promise<void> {
  const target = path.join(projectDir, REGISTRY_FILE);
  const tmp = `${target}.tmp`;

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(tmp, target);
}

function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Build the initial `RegistryManifest` for a freshly scaffolded
 * project. Called by `render.ts` at the end of the `@notionx/cli` scaffold flow.
 *
 * The manifest records:
 *   - the scaffold version + core dependency range
 *   - the primary content source the user picked
 *   - the default managed-files ownership map
 *   - a single `InstalledItem` for the primary content source
 *
 * `notionx add` will append to `installed`; `notionx update` will
 * bump `scaffoldVersion` and rewrite `managedFiles` as needed.
 */
export function buildInitialRegistryManifest(input: {
  projectName: string;
  scaffoldVersion: string;
  notionxCore: string;
  defaultLocale: string;
  supportedLocales: string[];
  enableSiteSettings: boolean;
  enableBlocks: boolean;
  enableAuth: boolean;
  enableAdmin: boolean;
  enablePages: boolean;
  enableSearch: boolean;
  contentSource: {
    id: string;
    title: string;
    fields: Array<{ key: string; notionName: string }>;
  };
  managedFiles: {
    platform: string[];
    bridge: string[];
    user: string[];
  };
  officialRegistryUrl?: string;
}): RegistryManifest {
  const officialSource: RegistrySourceRef = {
    kind: "official",
    name: "@notionx/official",
  };

  const primaryItem: InstalledItem = {
    id: input.contentSource.id,
    kind: "content-source",
    version: 1,
    source: officialSource,
    params: {
      contentSourceId: input.contentSource.id,
      ...(input.contentSource.id === "blog"
        ? {}
        : { basePath: `/${input.contentSource.id}` }),
    },
    installedAt: new Date().toISOString(),
  };

  // When the scaffold enables site-settings / blocks, register
  // them as InstalledItem entries so `notionx remove` can find
  // them. The file paths mirror the catalog declarations in
  // `registry-items.ts` — kept in sync manually (the catalog is
  // the source of truth; this is a snapshot for the manifest).
  const installed: InstalledItem[] = [primaryItem];

  if (input.enableSiteSettings) {
    installed.push({
      id: "site-settings",
      kind: "feature-module",
      version: 1,
      source: officialSource,
      params: {},
      installedAt: new Date().toISOString(),
      files: ["lib/site/settings.ts"],
    });
  }

  if (input.enableBlocks) {
    installed.push({
      id: "blocks",
      kind: "feature-module",
      version: 1,
      source: officialSource,
      params: {},
      installedAt: new Date().toISOString(),
      files: [
        "components/page-blocks.tsx",
        "components/page-blocks/hero-block.tsx",
        "components/page-blocks/feature-grid-block.tsx",
        "components/page-blocks/story-block.tsx",
        "components/page-blocks/latest-posts-block.tsx",
      ],
    });
  }

  if (input.enableAuth) {
    installed.push({
      id: "auth",
      kind: "feature-module",
      version: 1,
      source: officialSource,
      params: {},
      installedAt: new Date().toISOString(),
      files: [
        "lib/auth.config.ts",
        "app/api/auth/google/route.ts",
        "app/api/auth/google/callback/route.ts",
        "app/api/auth/verify-email/route.ts",
        "app/api/auth/viewer/route.ts",
        "app/login/page.tsx",
        "app/register/page.tsx",
      ],
    });
  }

  if (input.enableAdmin) {
    installed.push({
      id: "admin",
      kind: "feature-module",
      version: 1,
      source: officialSource,
      params: {},
      installedAt: new Date().toISOString(),
      files: [
        "app/admin/layout.tsx",
        "app/admin/page.tsx",
        "app/admin/loading.tsx",
        "app/admin/account/page.tsx",
        "app/admin/content-models/page.tsx",
        "lib/admin/nav.ts",
        "lib/admin/actions.ts",
        "lib/admin/context.tsx",
      ],
    });
  }

  if (input.enablePages) {
    installed.push({
      id: "pages",
      kind: "feature-module",
      version: 1,
      source: officialSource,
      params: {},
      installedAt: new Date().toISOString(),
      files: [
        "lib/pages/model.ts",
        "lib/pages/source.ts",
        "app/[slug]/page.tsx",
        "app/page.tsx",
      ],
    });
  }

  if (input.enableSearch) {
    installed.push({
      id: "search",
      kind: "feature-module",
      version: 1,
      source: officialSource,
      params: {},
      installedAt: new Date().toISOString(),
      files: [
        "lib/search/config.ts",
        "components/search/search-dialog.tsx",
        "migrations/0003_search_index.sql",
      ],
    });
  }

  installed.sort((a, b) => a.id.localeCompare(b.id));

  return {
    $schema: REGISTRY_SCHEMA_V2,
    projectKind: "notionx",
    projectName: input.projectName,
    scaffoldVersion: input.scaffoldVersion,
    notionxCore: input.notionxCore,
    defaultLocale: input.defaultLocale,
    supportedLocales: [...input.supportedLocales],
    enableSiteSettings: input.enableSiteSettings,
    enableBlocks: input.enableBlocks,
    enableAuth: input.enableAuth,
    enableAdmin: input.enableAdmin,
    enablePages: input.enablePages,
    enableSearch: input.enableSearch,
    contentSource: {
      id: input.contentSource.id,
      title: input.contentSource.title,
      fields: input.contentSource.fields.map((f) => ({
        key: f.key,
        notionName: f.notionName,
      })),
    },
    compat: { mode: "v2-native" },
    registries: {
      "@notionx/official": {
        url:
          input.officialRegistryUrl ??
          "https://registry.notionx.dev/official.json",
      },
    },
    installed,
    managedFiles: {
      platform: [...input.managedFiles.platform],
      bridge: [...input.managedFiles.bridge],
      user: [...input.managedFiles.user],
    },
  };
}
