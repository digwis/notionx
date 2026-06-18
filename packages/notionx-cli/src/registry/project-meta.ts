// packages/notionx-cli/src/registry/project-meta.ts
//
// Shared helpers used by install / uninstall / update:
//   - `readProjectMeta` reads `package.json` for the project name
//     and assembles the `MultiSourceProject` shape the token
//     builders need.
//   - `rerenderModelsFile` re-renders `lib/content/models.ts` from
//     its template using the current installed-item list.
//
// Both helpers lived as private duplicates in install.ts and
// update.ts (readProjectMeta) and in install.ts and uninstall.ts
// (rerenderModelsFile). They are collected here so there is one
// authoritative implementation.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildMultiSourceTokenMap, type MultiSourceProject } from "./render-multi-source.js";
import type { InstalledItem, RegistryManifest } from "./registry-types.js";

export type ProjectMeta = MultiSourceProject;

/**
 * Read `package.json` for the project name and assemble the
 * `MultiSourceProject` shape. Falls back to the directory basename
 * when `package.json` is missing or has no `name` field.
 */
export async function readProjectMeta(
  projectDir: string,
  manifest: RegistryManifest,
): Promise<ProjectMeta> {
  const pkgPath = path.join(projectDir, "package.json");
  let projectName = path.basename(projectDir);
  try {
    const raw = await readFile(pkgPath, "utf8");
    const parsed = JSON.parse(raw) as { name?: string };
    if (typeof parsed.name === "string" && parsed.name.length > 0) {
      projectName = parsed.name;
    }
  } catch {
    // No package.json (or unreadable). Fall back to dir basename.
  }

  return {
    projectName,
    targetDir: projectDir,
    defaultLocale: manifest.defaultLocale,
    supportedLocales: manifest.supportedLocales,
    notionxSource: manifest.notionxCore,
    adminEmail: "admin@example.com", // placeholder; not used by add/remove/update
    adminPassword: "", // placeholder; not used by add/remove/update
    scaffoldVersion: manifest.scaffoldVersion,
  };
}

/**
 * Re-render `lib/content/models.ts` from its template so the
 * `contentSources` / `managedContentSources` arrays stay in sync
 * with the installed-item list and the current internal-source
 * flags (`enableSiteSettings` / `enableBlocks`).
 *
 * Returns `{ wrote: false }` when the template file is missing
 * (e.g. a project that doesn't ship the models template).
 */
export async function rerenderModelsFile(input: {
  projectDir: string;
  templatesDir: string;
  project: ProjectMeta;
  installed: readonly InstalledItem[];
  /**
   * Which internal singleton sources to include. Defaults to both
   * enabled to match the pre-refactor behaviour. Callers should
   * pass the manifest's `enableSiteSettings` / `enableBlocks`
   * fields explicitly so the rendered file reflects the project's
   * current configuration.
   */
  internalSources?: { siteSettings?: boolean; blocks?: boolean };
  /**
   * When true, the rendered file emits
   * `defineContentSource({...})` declarations for the four
   * translation data sources instead of `null` stubs. Defaults to
   * `project.supportedLocales.length > 1` so callers that pass a
   * freshly-read manifest get bilingual mode automatically once a
   * second locale is added.
   */
  bilingual?: boolean;
  /** Preview only: compute the rendered content without writing it. */
  dryRun?: boolean;
}): Promise<{ wrote: boolean }> {
  const target = path.join(input.projectDir, "lib/content/models.ts");
  const tplPath = path.join(input.templatesDir, "lib/content/models.ts.tmpl");
  let tpl: string;
  try {
    tpl = await readFile(tplPath, "utf8");
  } catch {
    return { wrote: false };
  }

  const tokens = buildMultiSourceTokenMap({
    project: input.project,
    installed: input.installed,
    internalSources: input.internalSources,
    bilingual:
      input.bilingual ?? input.project.supportedLocales.length > 1,
  });

  const flat: Record<string, string> = {
    contentSourceDeclarations: tokens.contentSourceDeclarations,
    contentSourceSourcesVarNames: tokens.contentSourceSourcesVarNames,
    internalSourceDeclarations: tokens.internalSourceDeclarations,
    internalSourceVarNames: tokens.internalSourceVarNames,
    translationSourceDeclarations: tokens.translationSourceDeclarations,
  };
  const rendered = tpl.replace(
    /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g,
    (full, key: string) => {
      const v = flat[key];
      return typeof v === "string" ? v : full;
    },
  );
  if (input.dryRun) {
    return { wrote: true };
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, rendered, "utf8");
  return { wrote: true };
}
