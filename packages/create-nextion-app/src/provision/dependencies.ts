// packages/create-nextion-app/src/provision/dependencies.ts
//
// Detect and (if missing) install the external CLI tools the rest of
// the provisioning flow depends on. The most common offender is
// `wrangler`, which newer @notionx/core releases assume is on PATH
// at >=4.x for the JSON output flags we rely on. `ntn` is Notion's
// own CLI used for data-source creation.
//
// We prefer global installs because the provisioning step runs
// against the user's Cloudflare / Notion account, not against the
// freshly-scaffolded project (which has not had `pnpm install`
// executed yet).

import { spawn } from "node:child_process";
import * as p from "@clack/prompts";
import { run } from "./shell.js";

export interface DependencyCheck {
  name: string;
  /** npm package providing this binary, e.g. "wrangler@^4". */
  packageSpec: string;
  /** Minimum acceptable version, e.g. "4.0.0". Empty string = no check. */
  minVersion?: string;
  /** Why we need it — printed when prompting. */
  reason: string;
}

export const REQUIRED_DEPENDENCIES: DependencyCheck[] = [
  {
    name: "wrangler",
    packageSpec: "wrangler@latest",
    minVersion: "4.0.0",
    reason: "Used to create D1 / KV / R2 and to deploy the worker.",
  },
  {
    name: "ntn",
    packageSpec: "ntn@latest",
    reason: "Notion CLI used to create the content data source.",
  },
];

interface VersionInfo {
  raw: string;
  major: number;
}

function parseWranglerVersion(stdout: string): VersionInfo | null {
  // wrangler prints `wrangler 4.13.0` (or `3.114.0` for older builds)
  const m = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return {
    raw: `${m[1]}.${m[2]}.${m[3]}`,
    major: Number(m[1]),
  };
}

function parseNtnVersion(stdout: string): VersionInfo | null {
  // ntn prints `ntn 0.16.0` — major is always 0
  const m = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return {
    raw: `${m[1]}.${m[2]}.${m[3]}`,
    major: Number(m[1]),
  };
}

function parseVersion(
  name: string,
  stdout: string
): VersionInfo | null {
  if (name === "wrangler") return parseWranglerVersion(stdout);
  if (name === "ntn") return parseNtnVersion(stdout);
  // Generic fallback
  const m = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { raw: `${m[1]}.${m[2]}.${m[3]}`, major: Number(m[1]) } : null;
}

export interface CliStatus {
  name: string;
  available: boolean;
  version?: string;
  minVersion?: string;
  needsUpgrade?: boolean;
  installedNow?: boolean;
}

async function probeCli(name: string): Promise<{ ok: boolean; stdout: string }> {
  try {
    const r = await run(name, ["--version"], {});
    return { ok: r.code === 0, stdout: r.stdout };
  } catch {
    return { ok: false, stdout: "" };
  }
}

function isVersionAtLeast(actual: string, min: string): boolean {
  const a = actual.split(".").map((s) => Number(s) || 0);
  const m = min.split(".").map((s) => Number(s) || 0);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av > mv) return true;
    if (av < mv) return false;
  }
  return true;
}

/**
 * Install an npm package globally. Streams progress; doesn't throw on
 * non-zero exit so the caller can decide how to react.
 */
function npmInstallGlobal(packageSpec: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["install", "-g", packageSpec], {
      stdio: "inherit",
    });
    let stderr = "";
    if (child.stderr) {
      child.stderr.on("data", (d) => {
        stderr += d.toString();
      });
    }
    child.on("error", () => resolve({ code: -1, stderr }));
    child.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

/**
 * Ensure every required CLI tool is available at a usable version.
 * Prompts the user (in interactive mode) to install/upgrade missing
 * or outdated tools. Returns the final status for each. In
 * non-interactive mode, missing tools simply report `available: false`
 * — the caller is expected to surface this as a soft warning rather
 * than aborting.
 */
export async function ensureDependencies(
  deps: DependencyCheck[] = REQUIRED_DEPENDENCIES,
  options: { interactive: boolean }
): Promise<CliStatus[]> {
  const results: CliStatus[] = [];

  for (const dep of deps) {
    const probe = await probeCli(dep.name);

    if (!probe.ok) {
      p.log.warn(`${dep.name}: not found on PATH.`);
      if (options.interactive) {
        const install = await p.confirm({
          message: `Install ${dep.packageSpec} globally now? (${dep.reason})`,
          initialValue: true,
        });
        if (p.isCancel(install) || !install) {
          results.push({ name: dep.name, available: false, minVersion: dep.minVersion });
          continue;
        }
        const spinner = p.spinner();
        spinner.start(`Installing ${dep.packageSpec}…`);
        const r = await npmInstallGlobal(dep.packageSpec);
        if (r.code !== 0) {
          spinner.stop(`Failed to install ${dep.packageSpec}.`, 1);
          p.log.error(
            `Install failed. Run manually: npm install -g ${dep.packageSpec}`
          );
          results.push({ name: dep.name, available: false, minVersion: dep.minVersion });
          continue;
        }
        spinner.stop(`${dep.name} installed.`);
        // Re-probe
        const after = await probeCli(dep.name);
        if (!after.ok) {
          results.push({ name: dep.name, available: false, minVersion: dep.minVersion });
          continue;
        }
        const v = parseVersion(dep.name, after.stdout);
        results.push({
          name: dep.name,
          available: true,
          version: v?.raw,
          minVersion: dep.minVersion,
          installedNow: true,
        });
        continue;
      }
      // Non-interactive: just report missing
      results.push({ name: dep.name, available: false, minVersion: dep.minVersion });
      continue;
    }

    const v = parseVersion(dep.name, probe.stdout);
    if (!v) {
      // Couldn't parse version, assume it's fine
      results.push({ name: dep.name, available: true });
      continue;
    }

    if (dep.minVersion && !isVersionAtLeast(v.raw, dep.minVersion)) {
      p.log.warn(
        `${dep.name} ${v.raw} is older than required ${dep.minVersion}.`
      );
      if (options.interactive) {
        const upgrade = await p.confirm({
          message: `Upgrade to ${dep.packageSpec}?`,
          initialValue: true,
        });
        if (p.isCancel(upgrade) || !upgrade) {
          results.push({
            name: dep.name,
            available: true,
            version: v.raw,
            minVersion: dep.minVersion,
            needsUpgrade: true,
          });
          continue;
        }
        const spinner = p.spinner();
        spinner.start(`Upgrading ${dep.name}…`);
        const r = await npmInstallGlobal(dep.packageSpec);
        if (r.code !== 0) {
          spinner.stop(`Failed to upgrade ${dep.name}.`, 1);
          results.push({
            name: dep.name,
            available: true,
            version: v.raw,
            minVersion: dep.minVersion,
            needsUpgrade: true,
          });
          continue;
        }
        spinner.stop(`${dep.name} upgraded.`);
        const after = await probeCli(dep.name);
        const v2 = parseVersion(dep.name, after.stdout);
        results.push({
          name: dep.name,
          available: true,
          version: v2?.raw,
          minVersion: dep.minVersion,
          installedNow: true,
        });
        continue;
      }
      results.push({
        name: dep.name,
        available: true,
        version: v.raw,
        minVersion: dep.minVersion,
        needsUpgrade: true,
      });
      continue;
    }

    results.push({
      name: dep.name,
      available: true,
      version: v.raw,
      minVersion: dep.minVersion,
    });
  }

  return results;
}
