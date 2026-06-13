/**
 * Claude Code installer: writes SKILL.md + INSTALL.md + references/ to
 * `~/.claude/skills/nextion/` (user scope) or `./.claude/skills/nextion/`
 * (project scope).
 */
import type { InstallResult, Scope, SkillBundle } from "../types.js";
import {
  planDirectoryFiles,
  resolveBaseDir,
  writeUnlessExists,
} from "./base.js";

export interface InstallClaudeOptions {
  scope: Scope;
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
}

export async function installClaude(
  bundle: SkillBundle,
  opts: InstallClaudeOptions,
): Promise<InstallResult> {
  const baseDir = resolveBaseDir("claude", opts.scope, opts.cwd);
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

  return { target: "claude", scope: opts.scope, filesWritten: written, filesSkipped: skipped };
}
