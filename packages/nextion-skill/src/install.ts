/**
 * High-level orchestrator: given an `InstallOptions`, load the skill and run
 * the right installer(s).
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkill } from "./skill-source.js";
import { installTarget } from "./targets/index.js";
import { resolveCwd } from "./targets/base.js";
import type {
  InstallOptions,
  InstallResult,
  SkillBundle,
  Target,
} from "./types.js";
import { ALL_TARGETS } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Read the version of the installed nextion-skill package (from package.json). */
async function readSelfVersion(): Promise<string> {
  try {
    // dist/install.js -> packages/nextion-skill/package.json
    const pkgPath = resolve(__dirname, "..", "package.json");
    const json = JSON.parse(await readFile(pkgPath, "utf8")) as {
      version?: string;
    };
    return json.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Resolve the targets to install, expanding "all" into the full list. */
function expandTargets(target: InstallOptions["target"]): Target[] {
  if (target === "all") return [...ALL_TARGETS];
  return [target];
}

/**
 * Run a full install: load the skill and write it to one or more targets.
 * Returns a list of per-target results.
 */
export async function runInstall(
  opts: InstallOptions,
): Promise<{ bundle: SkillBundle; results: InstallResult[] }> {
  const cwd = resolveCwd(opts.cwd);
  const version = await readSelfVersion();
  const bundle = await loadSkill(opts.source, {
    githubRef: opts.githubRef,
    version,
  });

  const targets = expandTargets(opts.target);
  const results: InstallResult[] = [];
  for (const target of targets) {
    const result = await installTarget(target, bundle, {
      scope: opts.scope,
      cwd,
      force: opts.force,
      dryRun: opts.dryRun,
    });
    results.push(result);
  }

  return { bundle, results };
}
