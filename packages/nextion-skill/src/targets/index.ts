/** Aggregator: pick the right installer for a target id. */
import type { InstallResult, Scope, SkillBundle, Target } from "../types.js";
import { installClaude } from "./claude.js";
import { installTrae } from "./trae.js";
import { installCodex } from "./codex.js";

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
    case "codex":
      return await installCodex(bundle, opts);
    default: {
      const exhaustive: never = target;
      throw new Error(`Unknown target: ${String(exhaustive)}`);
    }
  }
}

export { installClaude, installTrae, installCodex };
