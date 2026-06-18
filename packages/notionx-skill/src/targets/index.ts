/** Aggregator: pick the right installer for a target id. */
import type { InstallResult, Scope, SkillBundle, Target } from "../types.js";
import { installClaude } from "./claude.js";
import { installTrae, installTraeCn } from "./trae.js";
import { installCodex, installCodexRules } from "./codex.js";
import { installDirectoryTarget } from "./base.js";

export interface CommonOptions {
  scope: Scope;
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
}

export async function installTarget(
  target: Target,
  bundle: SkillBundle,
  opts: CommonOptions,
): Promise<InstallResult> {
  switch (target) {
    case "claude":
      return await installClaude(bundle, opts);
    case "trae":
      return await installTrae(bundle, opts);
    case "trae-cn":
      return await installTraeCn(bundle, opts);
    case "codex":
      return await installCodex(bundle, opts);
    case "shared":
      return await installDirectoryTarget("shared", bundle, opts);
    case "codex-rules":
      return await installCodexRules(bundle, opts);
    default: {
      const exhaustive: never = target;
      throw new Error(`Unknown target: ${String(exhaustive)}`);
    }
  }
}

export { installClaude, installTrae, installTraeCn, installCodex, installCodexRules };
