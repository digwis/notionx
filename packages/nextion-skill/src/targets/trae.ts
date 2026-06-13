/**
 * Trae IDE installer: same shape as Claude Code (Trae reads SKILL.md format).
 */
import type { InstallResult, Scope, SkillBundle } from "../types.js";
import {
  planDirectoryFiles,
  resolveBaseDir,
  writeUnlessExists,
} from "./base.js";

export interface InstallTraeOptions {
  scope: Scope;
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
}

export async function installTrae(
  bundle: SkillBundle,
  opts: InstallTraeOptions,
): Promise<InstallResult> {
  const baseDir = resolveBaseDir("trae", opts.scope, opts.cwd);
  const files = planDirectoryFiles(baseDir, bundle);

  const written: InstallResult["filesWritten"] = [];
  const skipped: InstallResult["filesSkipped"] = [];

  for (const file of files) {
    const result = await writeUnlessExists(file.path, file.content, opts);
    if ("bytes" in result) {
      written.push(result);
    } else {
      skipped.push(result);
    }
  }

  return { target: "trae", scope: opts.scope, filesWritten: written, filesSkipped: skipped };
}
