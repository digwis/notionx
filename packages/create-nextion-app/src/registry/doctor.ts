// packages/create-nextion-app/src/registry/doctor.ts
//
// v2 project-side doctor. Walks the on-disk v2 state and reports
// drift, missing env, and pending migrations. Never touches
// Notion or Cloudflare. This is the CLI counterpart to
// `@notionx/core doctor` (which inspects runtime bindings) and
// does NOT replace it.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadRegistry } from "./load-registry.js";
import { REGISTRY_FILE } from "./registry-store.js";
import { MIGRATIONS_DIR, MIGRATIONS_META, readMigrationsMeta } from "./migrations-store.js";
import type { RegistryItem, InstalledItem } from "./registry-types.js";

export type DoctorSeverity = "ok" | "info" | "warn" | "error";

export interface DoctorCheck {
  /** Stable id for testing / filtering. */
  id: string;
  severity: DoctorSeverity;
  /** Human-readable message. */
  message: string;
  /** Optional fix-it hint. */
  hint?: string;
}

export interface DoctorReport {
  /** Resolved projectDir (always the cwd used to invoke the CLI). */
  projectDir: string;
  checks: DoctorCheck[];
  /** True if no check is `error` (warnings/info are still a pass). */
  ok: boolean;
}

export interface RunDoctorInput {
  projectDir: string;
  /** Catalog used to resolve installed items' capabilities. */
  catalogItems: readonly RegistryItem[];
}

export async function runProjectDoctor(input: RunDoctorInput): Promise<DoctorReport> {
  const { projectDir, catalogItems } = input;
  const checks: DoctorCheck[] = [];

  const registryPath = path.join(projectDir, REGISTRY_FILE);
  if (!existsSync(registryPath)) {
    checks.push({
      id: "registry.missing",
      severity: "error",
      message: `No ${REGISTRY_FILE} found in ${projectDir}.`,
      hint: "This directory is not a v2 nextion project. Run `npm create nextion-app` to scaffold one.",
    });
    return finalize(projectDir, checks);
  }

  let loaded;
  try {
    loaded = await loadRegistry(projectDir);
  } catch (err) {
    checks.push({
      id: "registry.unreadable",
      severity: "error",
      message: `Failed to read ${REGISTRY_FILE}: ${(err as Error).message}`,
    });
    return finalize(projectDir, checks);
  }

  const manifest = loaded.manifest;

  checks.push({
    id: "registry.present",
    severity: "ok",
    message: `Found ${REGISTRY_FILE} (scaffold ${manifest.scaffoldVersion}, nextionCore ${manifest.nextionCore}).`,
  });

  if (manifest.compat?.mode === "legacy-vinext") {
    checks.push({
      id: "registry.legacy-mode",
      severity: "info",
      message: "Project is in legacy-vinext compat mode (nextionCore is workspace:*).",
    });
  }

  // Pending migrations
  const meta = await readMigrationsMeta(projectDir);
  if (meta) {
    const pending = meta.history.filter((m) => !m.applied);
    if (pending.length > 0) {
      checks.push({
        id: "migrations.pending",
        severity: "warn",
        message: `${pending.length} pending migration(s) in .nextion/migrations/ (${pending.map((m) => m.sequence).join(", ")}).`,
        hint: "Run the SQL / notion-diff payloads, then `notionx migrate --mark-applied <seq>`.",
      });
    } else {
      checks.push({
        id: "migrations.clean",
        severity: "ok",
        message: `All ${meta.history.length} migration(s) marked applied.`,
      });
    }
  } else {
    checks.push({
      id: "migrations.absent",
      severity: "info",
      message: `No ${MIGRATIONS_DIR}/${MIGRATIONS_META} — no migrations generated yet.`,
    });
  }

  // Env-var check: each installed item's declared envVars must be in .dev.vars (if it exists)
  const devVarsPath = path.join(projectDir, ".dev.vars");
  let devVars: Set<string> | null = null;
  if (existsSync(devVarsPath)) {
    try {
      const raw = await readFile(devVarsPath, "utf8");
      devVars = parseDevVarsKeys(raw);
    } catch {
      devVars = null;
    }
  }

  // Walk installed items
  for (const item of manifest.installed) {
    const catalog = catalogItems.find((c) => c.id === item.id);
    if (!catalog) {
      checks.push({
        id: `installed.${item.id}.missing-in-catalog`,
        severity: "warn",
        message: `Installed item "${item.id}" is not in the current catalog; update or remove manually.`,
      });
      continue;
    }
    const envVars = catalog.capabilities.envVars ?? [];
    if (envVars.length === 0) continue;
    if (devVars === null) {
      checks.push({
        id: `installed.${item.id}.env-unverified`,
        severity: "info",
        message: `No .dev.vars — could not verify env vars for "${item.id}" (${envVars.join(", ")}).`,
      });
      continue;
    }
    const missing = envVars.filter((k) => !devVars!.has(k));
    if (missing.length > 0) {
      checks.push({
        id: `installed.${item.id}.env-missing`,
        severity: "warn",
        message: `Missing env vars for "${item.id}": ${missing.join(", ")}`,
        hint: `Add them to .dev.vars (or your Cloudflare secret store for production).`,
      });
    } else {
      checks.push({
        id: `installed.${item.id}.env-ok`,
        severity: "ok",
        message: `All ${envVars.length} env var(s) for "${item.id}" present in .dev.vars.`,
      });
    }
  }

  // @notionx/core dep version alignment
  const pkgPath = path.join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const raw = await readFile(pkgPath, "utf8");
      const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
      const coreDep = pkg.dependencies?.["@notionx/core"];
      if (coreDep && coreDep !== manifest.nextionCore) {
        checks.push({
          id: "core.drift",
          severity: "info",
          message: `package.json declares @notionx/core at ${coreDep}; manifest.nextionCore is ${manifest.nextionCore}.`,
          hint: "These should usually match; run `pnpm update @notionx/core` to align, or `notionx update` to regenerate.",
        });
      } else {
        checks.push({
          id: "core.aligned",
          severity: "ok",
          message: `@notionx/core dep (${coreDep ?? "absent"}) matches manifest.nextionCore (${manifest.nextionCore}).`,
        });
      }
    } catch {
      // ignore — package.json is optional
    }
  }

  return finalize(projectDir, checks);
}

function finalize(projectDir: string, checks: DoctorCheck[]): DoctorReport {
  const ok = checks.every((c) => c.severity !== "error");
  return { projectDir, checks, ok };
}

/**
 * Parse a `.dev.vars` file and return the set of variable names.
 * Lines starting with `#` and blank lines are ignored; values
 * are not validated.
 */
export function parseDevVarsKeys(raw: string): Set<string> {
  const keys = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    keys.add(trimmed.slice(0, eq).trim());
  }
  return keys;
}
