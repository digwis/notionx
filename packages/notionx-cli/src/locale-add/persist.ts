// packages/notionx-cli/src/locale-add/persist.ts
//
// Persistence helpers for `notionx locale add --apply`. After the
// runner creates Notion translation data sources, these helpers
// record the resulting data source ids in `registry.json` and
// patch `wrangler.jsonc` / `.dev.vars` so the worker can find them
// at runtime.
//
// All helpers are idempotent: running them twice with the same
// inputs overwrites the previous value with the same value, and
// leaves unrelated entries untouched.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  readRegistryManifest,
  writeRegistryManifest,
} from "../registry/registry-store.js";

/**
 * Map a translation source model id to its canonical env var name.
 * Returns the model id unchanged when no mapping is known (callers
 * can decide whether to treat that as an error).
 */
export function envVarForModel(modelId: string): string {
  const map: Record<string, string> = {
    "blog-translations": "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
    "page-translations": "NOTION_PAGES_TRANSLATIONS_DATA_SOURCE_ID",
    "block-translations": "NOTION_BLOCKS_TRANSLATIONS_DATA_SOURCE_ID",
    "site-settings-translations":
      "NOTION_SITE_SETTINGS_TRANSLATIONS_DATA_SOURCE_ID",
  };
  return map[modelId] ?? modelId;
}

/**
 * Persist created translation source ids into `registry.json`'s
 * `translationSources` map. Merges with any existing entries so
 * re-running `locale add` for a different locale doesn't drop the
 * previous refs.
 *
 * No-op when `translationSourceIds` is empty or the project has no
 * `registry.json` yet.
 */
export async function persistTranslationSourcesToRegistry(
  projectDir: string,
  translationSourceIds: Record<string, string>,
): Promise<void> {
  if (Object.keys(translationSourceIds).length === 0) return;
  const manifest = await readRegistryManifest(projectDir);
  if (!manifest) return;
  manifest.translationSources = {
    ...(manifest.translationSources ?? {}),
    ...Object.fromEntries(
      Object.entries(translationSourceIds).map(([modelId, dataSourceId]) => [
        modelId,
        { dataSourceId, envVar: envVarForModel(modelId) },
      ]),
    ),
  };
  await writeRegistryManifest(projectDir, manifest);
}

/**
 * Update `wrangler.jsonc` and `.dev.vars` with the new translation
 * source data source ids. For `wrangler.jsonc` we replace the value
 * inside the `vars` block; for `.dev.vars` we replace or append the
 * `KEY=VALUE` line. Files that don't exist are skipped silently.
 */
export async function updateEnvFilesForTranslationSources(
  projectDir: string,
  translationSourceIds: Record<string, string>,
): Promise<void> {
  for (const [modelId, dataSourceId] of Object.entries(
    translationSourceIds,
  )) {
    const envVar = envVarForModel(modelId);
    await updateEnvFile(projectDir, "wrangler.jsonc", envVar, dataSourceId);
    await updateEnvFile(projectDir, ".dev.vars", envVar, dataSourceId);
  }
}

/**
 * Patch a single env var value in either `wrangler.jsonc` (JSONC
 * `"KEY": "VALUE"` form) or `.dev.vars` (`KEY=VALUE` form).
 *
 * - If the file doesn't exist, returns silently (the project may
 *   not have a `.dev.vars` yet, or may use a different wrangler
 *   filename).
 * - If the key exists, its value is replaced.
 * - If the key doesn't exist in `.dev.vars`, it's appended.
 * - If the key doesn't exist in `wrangler.jsonc`, the file is left
 *   untouched (we don't try to insert into the JSONC structure —
 *   the scaffold template is expected to ship a placeholder).
 */
async function updateEnvFile(
  projectDir: string,
  filename: string,
  envVar: string,
  value: string,
): Promise<void> {
  const filePath = path.join(projectDir, filename);
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return; // File doesn't exist; skip.
  }

  if (filename === "wrangler.jsonc") {
    // Replace placeholder or existing value in wrangler.jsonc vars
    // block. Match: "ENV_VAR": "old_value" (covers both real ids
    // and REPLACE_WITH_... placeholders).
    // Use a non-global test regex to avoid the `lastIndex` pitfall,
    // then a global regex for the actual replacement.
    const testRegex = new RegExp(`"${envVar}"\\s*:\\s*"`);
    if (testRegex.test(content)) {
      const replaceRegex = new RegExp(
        `("${envVar}"\\s*:\\s*")([^"]*)(")`,
        "g",
      );
      content = content.replace(replaceRegex, `$1${value}$3`);
    }
  } else {
    // .dev.vars: KEY=VALUE format.
    const testRegex = new RegExp(`^${envVar}=`, "m");
    if (testRegex.test(content)) {
      const replaceRegex = new RegExp(`^${envVar}=.*$`, "gm");
      content = content.replace(replaceRegex, `${envVar}=${value}`);
    } else {
      content = content.trimEnd() + "\n" + `${envVar}=${value}\n`;
    }
  }

  await writeFile(filePath, content, "utf8");
}
