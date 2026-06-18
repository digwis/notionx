/**
 * Trae IDE installer: same shape as Claude Code (Trae reads SKILL.md format).
 */
import type { InstallResult, Scope, SkillBundle } from "../types.js";
import { installDirectoryTarget } from "./base.js";

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
  return await installDirectoryTarget("trae", bundle, opts);
}

export async function installTraeCn(
  bundle: SkillBundle,
  opts: InstallTraeOptions,
): Promise<InstallResult> {
  return await installDirectoryTarget("trae-cn", bundle, opts);
}
