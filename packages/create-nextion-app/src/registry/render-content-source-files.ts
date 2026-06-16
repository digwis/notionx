// packages/create-nextion-app/src/registry/render-content-source-files.ts
//
// Render all files declared by a `RegistryItem` into the project.
//
// Each `RegistryFile` in the item's `files` array may carry a
// `template` path (relative to the templates directory). The
// renderer reads that template, substitutes tokens, and writes
// the result to the file's `path` (relative to the project root).
// Files without a `template` are skipped.
//
// The token set is the same multi-source token map used by
// `render.ts` at scaffold time, plus per-item overrides so the
// template sees *this* item's id/path/var-name (not the
// alphabetically-first installed source).

import { promises as fs } from "node:fs";
import path from "node:path";

import { buildMultiSourceTokenMap } from "./render-multi-source.js";
import { toCamel, titleCase } from "./text-utils.js";
import type { InstalledItem, RegistryItem } from "./registry-types.js";

export interface RenderedContentSourceFile {
  /** Absolute path on disk. */
  absolutePath: string;
  /** Path relative to the project root (for diff/log output). */
  projectRelativePath: string;
  /** Ownership classification. Mirrors the `RegistryFile.ownership` shape. */
  ownership: "user" | "bridge" | "platform";
  /** Whether the file already existed before this render. */
  existed: boolean;
  /** Resolved content (after token substitution). */
  content: string;
}

export interface RenderContentSourceFilesInput {
  projectDir: string;
  templatesDir: string;
  /** The single content source to render files for (the one being added). */
  item: RegistryItem;
  /**
   * The **previously installed** items. The new item itself is
   * added by the caller in the caller's `installed` arg.
   */
  installed: readonly InstalledItem[];
  /** All project metadata needed to build tokens (mirrors `MultiSourceProject`). */
  project: {
    projectName: string;
    targetDir: string;
    defaultLocale: string;
    supportedLocales: readonly string[];
    nextionSource: string;
    adminEmail: string;
    adminPassword: string;
    scaffoldVersion: string;
  };
}

/**
 * Render all files declared by `input.item` that have a `template`
 * path. Returns one `RenderedContentSourceFile` per rendered file.
 *
 * For `content-source` items, per-item tokens (contentSourceId,
 * contentSourceListPath, etc.) are computed and injected. For
 * `feature-module` items, only the shared multi-source tokens are
 * injected — feature-module templates don't use content-source
 * tokens.
 *
 * `internalSources` controls which internal singleton sources
 * (siteSettingsSource, blocksSource) appear in the generated
 * `models.ts` block. Callers should pass the manifest's
 * `enableSiteSettings` / `enableBlocks` flags (adjusted for the
 * item being installed if it's a feature-module).
 */
export async function renderContentSourceFiles(
  input: RenderContentSourceFilesInput & {
    internalSources?: { siteSettings?: boolean; blocks?: boolean };
  },
): Promise<RenderedContentSourceFile[]> {
  const installedWithNew = dedupeInstalled([
    ...input.installed,
    {
      id: input.item.id,
      kind: input.item.kind,
      version: input.item.version,
      source: input.item.source,
      params: input.item.params,
      installedAt: new Date(0).toISOString(),
    },
  ]);

  // Multi-source bookkeeping tokens (sources block, env vars, var
  // names) — independent of which item is being rendered.
  const tokens = buildMultiSourceTokenMap({
    project: input.project,
    installed: installedWithNew,
    internalSources: input.internalSources,
  });

  const flat: Record<string, string> = {
    contentSourceDeclarations: tokens.contentSourceDeclarations,
    contentSourceSourcesVarNames: tokens.contentSourceSourcesVarNames,
    internalSourceDeclarations: tokens.internalSourceDeclarations,
    internalSourceVarNames: tokens.internalSourceVarNames,
    projectName: input.project.projectName,
    projectNameLower: input.project.projectName.toLowerCase(),
    targetDir: input.project.targetDir,
    defaultLocale: input.project.defaultLocale,
    supportedLocales: input.project.supportedLocales.join(", "),
    supportedLocalesJson: JSON.stringify(input.project.supportedLocales),
    nextionSource: input.project.nextionSource,
  };

  // For content-source items, add per-item tokens so the template
  // sees this item's id/path/var-name. Feature-module items don't
  // use these tokens.
  if (input.item.kind === "content-source") {
    const perItem = computePerItemTokens(input.item);
    Object.assign(flat, {
      contentSourceId: perItem.contentSourceId,
      contentSourceTitle: perItem.contentSourceTitle,
      contentSourceListPath: perItem.contentSourceListPath,
      contentSourceVarName: perItem.contentSourceVarName,
      contentSourceConstName: perItem.contentSourceConstName,
      contentSourceNavLabel: perItem.contentSourceNavLabel,
      contentSourceListTitle: perItem.contentSourceListTitle,
      contentSourceListDescription: perItem.contentSourceListDescription,
      contentSourceEmptyState: perItem.contentSourceEmptyState,
    });
  }

  const out: RenderedContentSourceFile[] = [];

  for (const file of input.item.files) {
    if (!file.template) continue;

    // The template path is a LITERAL path on disk — the
    // `{{...}}` segments are real directory names (e.g.
    // `app/{{contentSourceListPath}}/page.tsx.tmpl`). Token
    // substitution only applies to the template *content*,
    // not the path.
    const tplAbs = path.join(input.templatesDir, file.template);

    let tpl: string;
    try {
      tpl = await fs.readFile(tplAbs, "utf8");
    } catch {
      // Template file doesn't exist — skip silently. The catalog
      // may declare files whose templates ship in a later version.
      continue;
    }

    const rendered = renderTemplate(tpl, flat);
    const destAbs = path.join(input.projectDir, file.path);
    const existed = await pathExists(destAbs);

    out.push({
      absolutePath: destAbs,
      projectRelativePath: file.path,
      ownership: file.ownership,
      existed,
      content: rendered,
    });
  }

  return out;
}

function dedupeInstalled(items: InstalledItem[]): InstalledItem[] {
  const seen = new Map<string, InstalledItem>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function computePerItemTokens(item: RegistryItem): {
  contentSourceId: string;
  contentSourceTitle: string;
  contentSourceListPath: string;
  contentSourceVarName: string;
  contentSourceConstName: string;
  contentSourceNavLabel: string;
  contentSourceListTitle: string;
  contentSourceListDescription: string;
  contentSourceEmptyState: string;
} {
  const id = item.id;
  const basePath = item.params.basePath;
  const listPath = basePath ?? `/${id}`;
  const camel = toCamel(id);
  return {
    contentSourceId: id,
    contentSourceTitle: titleCase(id),
    contentSourceListPath: listPath,
    contentSourceVarName: `${camel}Source`,
    contentSourceConstName: `${camel}ContentModel`,
    contentSourceNavLabel: titleCase(id),
    contentSourceListTitle: titleCase(id),
    contentSourceListDescription: `${titleCase(id)} entries backed by Notion.`,
    contentSourceEmptyState: `No ${id} entries yet.`,
  };
}

function renderTemplate(input: string, tokens: Record<string, string>): string {
  return input.replace(
    /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g,
    (full, key: string) => {
      const value = tokens[key];
      if (typeof value === "string") return value;
      return full;
    },
  );
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
