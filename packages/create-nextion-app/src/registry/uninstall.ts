// packages/create-nextion-app/src/registry/uninstall.ts
//
// Core `nextion remove <id>` logic.
//
// Contract (mirrors `install.ts`):
//   1. Read `.nextion/registry.json`.
//   2. Reject if the item is not installed.
//   3. Refuse to remove an item that other items still depend on
//      (e.g. can't remove `docs` if `search` requires it).
//   4. Re-render `lib/content/models.ts` without the removed item.
//   5. Update `registry.json` (drop the item; clear its file
//      entries from `managedFiles`).
//   6. For `content-source` items: by default, do NOT delete the
//      source's files from disk. Pass `purge: true` to delete the
//      files recorded on `InstalledItem.files` at install time.
//   7. For `feature-module` items: render each file's
//      `fallbackTemplate` to the same `path` (overwriting the
//      Notion-backed version) so downstream importers keep
//      compiling. Files without a `fallbackTemplate` are left on
//      disk unless `purge: true` is passed.
//   8. Flip the item's `featureFlag` to `false` in the manifest
//      (feature-module items only).
//   9. Never touch Notion or D1 data — surface cleanup as followup.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getOfficialItem } from "./registry-items.js";
import { loadRegistry } from "./load-registry.js";
import { writeRegistryManifest } from "./registry-store.js";
import {
  readProjectMeta,
  rerenderModelsFile,
} from "./project-meta.js";
import {
  type InstalledItem,
  type RegistryItem,
  type RegistryManifest,
} from "./registry-types.js";

export interface UninstallInput {
  projectDir: string;
  templatesDir: string;
  /** Item id to remove. */
  itemId: string;
  /**
   * `true` deletes the source's files from disk (the exact set
   * recorded on `InstalledItem.files` at install time). Default
   * `false` — we keep the file contents so the user can re-add
   * or hand-edit them; the runtime simply stops importing them.
   */
  purge?: boolean;
  /**
   * `false` makes the function a pure planner. Used by
   * `nextion remove --dry-run`.
   */
  dryRun?: boolean;
}

export interface UninstallSummary {
  removedItem: InstalledItem;
  /** Whether `models.ts` was re-rendered. */
  rerenderedModels: boolean;
  /** Whether `.nextion/registry.json` was written. */
  wroteManifest: boolean;
  /** Files that were deleted (only non-empty when `purge` is true). */
  deletedFiles: string[];
  /** Files that *would* be deleted under `--purge` (always populated). */
  purgeableFiles: string[];
  /**
   * Files whose contents were replaced with the fallback template
   * (feature-module items only). Same `path` as the original, but
   * the rendered content now comes from `fallbackTemplate`.
   */
  fallbackRenderedFiles: string[];
  /** Followup todos (Notion/D1 cleanup, dependents to re-add). */
  followup: string[];
}

export class UninstallError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unknown-item"
      | "not-installed"
      | "still-required",
  ) {
    super(message);
    this.name = "UninstallError";
  }
}

/**
 * Uninstall a registry item from the project at `projectDir`.
 *
 * Throws `UninstallError` on the common failure modes.
 */
export async function uninstallItem(
  input: UninstallInput,
): Promise<UninstallSummary> {
  const { projectDir, templatesDir, itemId } = input;
  const loaded = await loadRegistry(projectDir);
  const manifest = loaded.manifest;

  const installed = manifest.installed.find((i) => i.id === itemId);
  if (!installed) {
    throw new UninstallError(
      `"${itemId}" is not installed in this project. ` +
        `Run \`nextion add ${itemId}\` to install it.`,
      "not-installed",
    );
  }

  // Look up the catalog item to access `featureFlag` and
  // `fallbackTemplate` metadata. The `InstalledItem` snapshot
  // doesn't carry these — they live on the catalog `RegistryItem`.
  const catalogItem = getOfficialItem(itemId);

  // Refuse to remove an item that is `requires`d by something
  // else still installed. The user must remove the dependent
  // items first (e.g. `nextion remove search` before
  // `nextion remove docs`). The `requires` list lives on the
  // catalog's `RegistryItem`, not on `InstalledItem` — we look
  // it up by id at check time.
  const blockers = manifest.installed.filter((i) => {
    const catalog = getOfficialItem(i.id);
    if (!catalog) return false;
    return (catalog.requires ?? []).some((req) => req.id === itemId);
  });
  if (blockers.length > 0) {
    const names = blockers.map((b) => b.id).join(", ");
    throw new UninstallError(
      `Cannot remove "${itemId}" — required by: ${names}. ` +
        `Remove those first.`,
      "still-required",
    );
  }

  // The exact file list to purge: prefer the snapshot stored on
  // `InstalledItem.files` (accurate). Fall back to an empty list
  // for items installed before the `files` field existed.
  const purgeable = installed.files ?? [];

  // Compute the next manifest: drop the item, drop its file
  // entries from `managedFiles`, and flip the feature flag to
  // `false` if this is a feature-module item.
  const nextManifest: RegistryManifest = {
    ...manifest,
    installed: manifest.installed.filter((i) => i.id !== itemId),
    managedFiles: clearItemFromManagedFiles(manifest, installed),
    ...applyFeatureFlagForUninstall(catalogItem),
  };

  // Compute the `internalSources` flags to pass to the renderers.
  // For feature-module items, the flag being uninstalled flips to
  // `false` so the generated `models.ts` drops the corresponding
  // internal singleton source. For other kinds, the flags are
  // unchanged from the (already-updated) nextManifest.
  const internalSourcesForRender = {
    siteSettings: nextManifest.enableSiteSettings,
    blocks: nextManifest.enableBlocks,
  };

  // Re-render `lib/content/models.ts` to drop the source from
  // `contentSources` / `managedContentSources` (and, for
  // feature-module items, the internal singleton source).
  const project = await readProjectMeta(projectDir, manifest);
  const modelsResult = await rerenderModelsFile({
    projectDir,
    templatesDir,
    project,
    installed: nextManifest.installed,
    internalSources: internalSourcesForRender,
  });

  // For feature-module items, render the fallback templates to
  // the same paths so downstream importers keep compiling. The
  // fallback list is computed up-front so dry-run can report it.
  const fallbackFiles = catalogItem
    ? collectFallbackFiles(catalogItem)
    : [];
  const fallbackRenderedFiles: string[] = [];

  const followup = buildFollowupTasks(
    installed,
    blockers,
    input.purge ?? false,
    catalogItem,
  );

  if (input.dryRun) {
    return {
      removedItem: installed,
      rerenderedModels: modelsResult.wrote,
      wroteManifest: false,
      deletedFiles: [],
      purgeableFiles: purgeable,
      fallbackRenderedFiles: fallbackFiles.map((f) => f.path),
      followup,
    };
  }

  // Render fallback templates for feature-module items.
  if (fallbackFiles.length > 0) {
    const tokens = buildFallbackTokens(project);
    for (const file of fallbackFiles) {
      const tplAbs = path.join(templatesDir, file.fallbackTemplate);
      let tpl: string;
      try {
        tpl = await readFile(tplAbs, "utf8");
      } catch {
        // Fallback template missing — skip silently (file stays
        // as-is on disk; user can hand-edit if needed).
        continue;
      }
      const rendered = renderTemplate(tpl, tokens);
      const destAbs = path.join(projectDir, file.path);
      await mkdir(path.dirname(destAbs), { recursive: true });
      await writeFile(destAbs, rendered, "utf8");
      fallbackRenderedFiles.push(file.path);
    }
  }

  // Delete files from disk if `--purge` was passed.
  const deletedFiles: string[] = [];
  if (input.purge) {
    for (const relPath of purgeable) {
      const absPath = path.join(projectDir, relPath);
      try {
        await rm(absPath, { recursive: true, force: true });
        deletedFiles.push(relPath);
      } catch {
        // File may have been manually deleted already — skip.
      }
    }
  }

  await writeRegistryManifest(projectDir, nextManifest);

  return {
    removedItem: installed,
    rerenderedModels: modelsResult.wrote,
    wroteManifest: true,
    deletedFiles,
    purgeableFiles: purgeable,
    fallbackRenderedFiles,
    followup,
  };
}

// ---- internals ----

function clearItemFromManagedFiles(
  manifest: RegistryManifest,
  installed: InstalledItem,
): RegistryManifest["managedFiles"] {
  // Use the authoritative file list recorded on `InstalledItem.files`
  // at install time. The old path-heuristic (`/${itemId}/`) missed
  // files whose paths don't contain the item id as a path segment
  // (e.g. `migrations/0003_search_index.sql` for the `search` item).
  const itemFiles = new Set(installed.files ?? []);
  const filterPath = (p: string) => !itemFiles.has(p);
  return {
    platform: manifest.managedFiles.platform.filter(filterPath),
    bridge: manifest.managedFiles.bridge.filter(filterPath),
    user: manifest.managedFiles.user.filter(filterPath),
  };
}

/**
 * Return a partial manifest patch that flips the feature flag
 * controlled by `item` to `false`. Returns `{}` for items without
 * a `featureFlag` (content-source / platform-extension / unknown).
 */
function applyFeatureFlagForUninstall(
  item: RegistryItem | undefined,
): Partial<RegistryManifest> {
  if (!item || !item.featureFlag) return {};
  return { [item.featureFlag]: false } as Partial<RegistryManifest>;
}

/**
 * Collect the files on `item` that declare a `fallbackTemplate`.
 * These are the files that get overwritten with the fallback
 * content during uninstall (instead of being deleted).
 */
function collectFallbackFiles(
  item: RegistryItem,
): Array<{ path: string; fallbackTemplate: string }> {
  const out: Array<{ path: string; fallbackTemplate: string }> = [];
  for (const file of item.files) {
    if (file.fallbackTemplate) {
      out.push({ path: file.path, fallbackTemplate: file.fallbackTemplate });
    }
  }
  return out;
}

/**
 * Build the minimal token map used by fallback templates. Fallback
 * templates are intentionally simple (they return static content)
 * so they only need the basic project tokens — no content-source
 * or internal-source tokens.
 */
function buildFallbackTokens(project: {
  projectName: string;
  defaultLocale: string;
  supportedLocales: readonly string[];
  nextionSource: string;
}): Record<string, string> {
  return {
    projectName: project.projectName,
    projectNameLower: project.projectName.toLowerCase(),
    defaultLocale: project.defaultLocale,
    supportedLocales: project.supportedLocales.join(", "),
    supportedLocalesJson: JSON.stringify(project.supportedLocales),
    nextionSource: project.nextionSource,
  };
}

function renderTemplate(
  input: string,
  tokens: Record<string, string>,
): string {
  return input.replace(
    /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g,
    (full, key: string) => {
      const value = tokens[key];
      if (typeof value === "string") return value;
      return full;
    },
  );
}

function buildFollowupTasks(
  item: InstalledItem,
  blockers: readonly InstalledItem[],
  purged: boolean,
  catalogItem: RegistryItem | undefined,
): string[] {
  const out: string[] = [];
  const isFeatureModule = catalogItem?.kind === "feature-module";
  if (isFeatureModule) {
    out.push(
      `The fallback version of "${item.id}" is now active. ` +
        `Re-add with \`nextion add ${item.id}\` to restore the Notion-backed version.`,
    );
  } else {
    out.push(
      `The data source for "${item.id}" in Notion is untouched. ` +
        `Re-add with \`nextion add ${item.id}\` to wire it back, or ` +
        `manually archive the Notion data source.`,
    );
  }
  if (!purged && blockers.length === 0) {
    out.push(
      `Run \`nextion remove --purge ${item.id}\` to also delete the generated files.`,
    );
  }
  return out;
}
