/**
 * Claude Code installer: writes SKILL.md + INSTALL.md + references/ to
 * `~/.claude/skills/notionx/` (user scope) or `./.claude/skills/notionx/`
 * (project scope).
 */
import type { InstallResult, Scope, SkillBundle } from "../types.js";
import { installDirectoryTarget } from "./base.js";

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
  return await installDirectoryTarget("claude", bundle, opts);
}
