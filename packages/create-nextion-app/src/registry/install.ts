// packages/create-nextion-app/src/registry/install.ts
//
// Core `nextion add <id>` logic. v1 of this module wires the
// minimal subset needed to make `nextion add docs` a working
// command; richer behaviour (Notion schema sync, codemods,
// file-content merge for `user`-owned files) lives in PR 4.
//
// The contract:
//   1. Read `.nextion/registry.json`.
//   2. Reject if the item is already installed, or if a
//      `requires` dependency is missing.
//   3. Render the new item's files (using the project templates
//      directory, which the CLI looks up next to its own package).
//   4. Re-render `lib/content/models.ts` so the new source shows
//      up in `contentSources` / `managedContentSources`.
//   5. Write the new `registry.json` and a human-readable followup
//      list (Notion env vars to set, D1 migrations to apply).
//
// Everything is pure async + returns a summary object; the CLI
// layer is responsible for printing the summary.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getOfficialItem, listOfficialItems } from "./registry-items.js";
import { loadRegistry } from "./load-registry.js";
import { renderContentSourceFiles } from "./render-content-source-files.js";
import { writeRegistryManifest } from "./registry-store.js";
import {
  readProjectMeta,
  rerenderModelsFile,
} from "./project-meta.js";
import {
  type InstalledItem,
  type RegistryItem,
  type RegistryManifest,
  type RegistrySourceRef,
} from "./registry-types.js";

export interface InstallInput {
  projectDir: string;
  templatesDir: string;
  /** Item id to install (e.g. "docs", "search"). */
  itemId: string;
  /**
   * Optional param overrides. Any key the user passes wins over
   * the catalog default. PR 3 only wires the lookup; PR 4 adds
   * the interactive prompt for unknown params.
   */
  params?: Record<string, string>;
  /**
   * `false` makes `installItem()` a pure planner — no file writes,
   * no manifest updates. Used by `nextion add --dry-run`.
   */
  dryRun?: boolean;
}

export interface InstallSummary {
  item: RegistryItem;
  installed: InstalledItem;
  /** Files rendered (or that *would* be rendered in dry-run). */
  files: Array<{
    projectRelativePath: string;
    ownership: "user" | "bridge" | "platform";
    existed: boolean;
  }>;
  /** Whether `models.ts` was re-rendered. */
  rerenderedModels: boolean;
  /** Whether `.nextion/registry.json` was written. */
  wroteManifest: boolean;
  /** Human-readable followup tasks (printed by the CLI). */
  followup: string[];
}

export class InstallError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unknown-item"
      | "already-installed"
      | "missing-requirement"
      | "incompatible-compat",
  ) {
    super(message);
    this.name = "InstallError";
  }
}

/**
 * Install a registry item into the project at `projectDir`.
 *
 * Throws `InstallError` on the common failure modes so the CLI
 * can print a stable, human-readable error.
 */
export async function installItem(input: InstallInput): Promise<InstallSummary> {
  const { projectDir, templatesDir, itemId } = input;
  const item = getOfficialItem(itemId);
  if (!item) {
    throw new InstallError(
      `Unknown registry item "${itemId}". Run \`nextion add --list\` to see available items.`,
      "unknown-item",
    );
  }
  const finalItem: RegistryItem = input.params
    ? { ...item, params: { ...item.params, ...input.params } }
    : item;

  // Load the current registry.
  const loaded = await loadRegistry(projectDir);
  const manifest = loaded.manifest;

  // Idempotency: reject re-installing the same id. `nextion update`
  // handles version upgrades; `nextion add` is for new items.
  if (manifest.installed.some((i) => i.id === finalItem.id)) {
    throw new InstallError(
      `"${finalItem.id}" is already installed in this project. ` +
        `Use \`nextion update ${finalItem.id}\` to upgrade it, ` +
        `or \`nextion remove ${finalItem.id}\` to uninstall.`,
      "already-installed",
    );
  }

  // Dependency check: every `requires` entry must be satisfied by
  // something already installed. We use simple semver-equality
  // (only ">=X" today); PR 4 will add a `semver.satisfies` check
  // for ranges.
  for (const req of finalItem.requires ?? []) {
    const dep = manifest.installed.find((i) => i.id === req.id);
    if (!dep) {
      throw new InstallError(
        `"${finalItem.id}" requires "${req.id}" to be installed first. ` +
          `Run \`nextion add ${req.id}\` and try again.`,
        "missing-requirement",
      );
    }
  }

  // Compute the new installed record. We snapshot the rendered
  // file paths so `nextion remove --purge` can delete the exact
  // set that was written (no heuristic path matching).
  const installed: InstalledItem = {
    id: finalItem.id,
    kind: finalItem.kind,
    version: finalItem.version,
    source: finalItem.source,
    params: finalItem.params,
    installedAt: new Date().toISOString(),
  };

  // The list of "currently installed" used for token rendering
  // is the existing list **plus** the new item (in the same
  // alphabetical order so generated diffs are stable).
  const installedForRender: InstalledItem[] = [
    ...manifest.installed,
    installed,
  ].sort((a, b) => a.id.localeCompare(b.id));

  const project = await readProjectMeta(projectDir, manifest);

  // For feature-module items, the install flips the manifest flag
  // to `true` so `rerenderModelsFile` includes the corresponding
  // internal singleton source. For content-source items, the
  // flags are unchanged.
  const internalSourcesForRender = computeInternalSourcesForInstall(
    manifest,
    finalItem,
  );

  // Render the new files (currently: just the list page).
  const rendered = await renderContentSourceFiles({
    projectDir,
    templatesDir,
    item: finalItem,
    installed: installedForRender,
    project,
    internalSources: internalSourcesForRender,
  });

  // Re-render `lib/content/models.ts` so the new source is
  // registered in `contentSources` / `managedContentSources`.
  const modelsResult = await rerenderModelsFile({
    projectDir,
    templatesDir,
    project,
    installed: installedForRender,
    internalSources: internalSourcesForRender,
  });

  // Snapshot the rendered file paths on the InstalledItem so
  // `nextion remove --purge` can delete the exact set later.
  installed.files = rendered.map((f) => f.projectRelativePath);

  const followup: string[] = buildFollowupTasks(finalItem, manifest);

  if (input.dryRun) {
    return {
      item: finalItem,
      installed,
      files: rendered.map((f) => ({
        projectRelativePath: f.projectRelativePath,
        ownership: f.ownership,
        existed: f.existed,
      })),
      rerenderedModels: modelsResult.wrote,
      wroteManifest: false,
      followup,
    };
  }

  // Write the rendered files.
  for (const file of rendered) {
    await mkdir(path.dirname(file.absolutePath), { recursive: true });
    await writeFile(file.absolutePath, file.content, "utf8");
  }

  // Update the manifest: add the new InstalledItem, the
  // `user`/`bridge` files to `managedFiles`, and flip the
  // feature flag (if this is a feature-module item).
  const nextManifest: RegistryManifest = {
    ...manifest,
    installed: installedForRender,
    managedFiles: mergeManagedFilesForInstall(manifest, finalItem),
    ...applyFeatureFlag(manifest, finalItem, true),
  };
  await writeRegistryManifest(projectDir, nextManifest);

  return {
    item: finalItem,
    installed,
    files: rendered.map((f) => ({
      projectRelativePath: f.projectRelativePath,
      ownership: f.ownership,
      existed: f.existed,
    })),
    rerenderedModels: modelsResult.wrote,
    wroteManifest: true,
    followup,
  };
}

// ---- internals ----

function buildFollowupTasks(
  item: RegistryItem,
  _manifest: RegistryManifest,
): string[] {
  const out: string[] = [];
  for (const env of item.capabilities.envVars ?? []) {
    out.push(
      `Set \`${env}\` in .dev.vars (see Notion data source for the id).`,
    );
  }
  for (const ds of item.capabilities.notionDataSources ?? []) {
    out.push(
      `Create the matching Notion data source and set \`${ds}\` in .dev.vars.`,
    );
  }
  if ((item.capabilities.d1Tables ?? []).length > 0) {
    out.push(
      `Run \`wrangler d1 migrations apply <DB_NAME> --remote\` to create the new tables.`,
    );
  }
  return out;
}

function mergeManagedFilesForInstall(
  manifest: RegistryManifest,
  item: RegistryItem,
): RegistryManifest["managedFiles"] {
  const user = new Set(manifest.managedFiles.user);
  const bridge = new Set(manifest.managedFiles.bridge);
  const platform = new Set(manifest.managedFiles.platform);
  for (const file of item.files) {
    if (file.ownership === "user") user.add(file.path);
    else if (file.ownership === "bridge") bridge.add(file.path);
    else platform.add(file.path);
  }
  return {
    platform: [...platform].sort(),
    bridge: [...bridge].sort(),
    user: [...user].sort(),
  };
}

/**
 * Compute the `internalSources` flags to pass to the renderers
 * during install. For feature-module items, the flag being
 * installed flips to `true` so the generated `models.ts` includes
 * the corresponding internal singleton source. For other kinds,
 * the flags are unchanged from the manifest.
 */
function computeInternalSourcesForInstall(
  manifest: RegistryManifest,
  item: RegistryItem,
): { siteSettings: boolean; blocks: boolean } {
  const siteSettings =
    item.featureFlag === "enableSiteSettings"
      ? true
      : manifest.enableSiteSettings;
  const blocks =
    item.featureFlag === "enableBlocks" ? true : manifest.enableBlocks;
  return { siteSettings, blocks };
}

/**
 * Return a partial manifest patch that flips the feature flag
 * controlled by `item` to `value`. Returns `{}` for items without
 * a `featureFlag` (content-source / platform-extension).
 */
function applyFeatureFlag(
  _manifest: RegistryManifest,
  item: RegistryItem,
  value: boolean,
): Partial<RegistryManifest> {
  if (!item.featureFlag) return {};
  return { [item.featureFlag]: value } as Partial<RegistryManifest>;
}

// Re-export so consumers don't have to dig through sub-paths.
export type { RegistryItem, InstalledItem, RegistrySourceRef };
export { listOfficialItems };
