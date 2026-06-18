import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { MONOREPO_PROTOCOL } from "../notionx-source.js";
import { loadRegistry } from "./load-registry.js";
import { REGISTRY_FILE, writeRegistryManifest } from "./registry-store.js";

const CORE_PACKAGE = "@notionx/core";
const CLI_PACKAGE = "@notionx/cli";
const REGISTRY_TIMEOUT_MS = 5_000;

export type CoreUpdateDistTag = "latest" | "next";

export type CoreUpdateTarget =
  | { kind: "dist-tag"; tag: CoreUpdateDistTag }
  | { kind: "spec"; spec: string };

export interface ApplyCoreUpdateInput {
  projectDir: string;
  dryRun?: boolean;
  target?: CoreUpdateTarget;
}

export interface CoreUpdateChange {
  file: string;
  field: string;
  from: string | null;
  to: string;
}

export interface ApplyCoreUpdateSummary {
  dryRun: boolean;
  targetCore: string;
  targetCli?: string;
  changes: CoreUpdateChange[];
  followup: string[];
  skipped?: string;
}

type DependencySection = "dependencies" | "devDependencies";

type PackageJson = Record<string, unknown> & {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export async function applyCoreUpdate(
  input: ApplyCoreUpdateInput,
): Promise<ApplyCoreUpdateSummary> {
  const { projectDir } = input;
  const packagePath = path.join(projectDir, "package.json");
  const rawPackage = await readFile(packagePath, "utf8");
  const packageJson = JSON.parse(rawPackage) as PackageJson;
  const nextPackageJson = JSON.parse(rawPackage) as PackageJson;
  const registry = await loadRegistry(projectDir);
  const manifest = registry.manifest;
  const currentCore = getDependency(packageJson, CORE_PACKAGE) ?? manifest.notionxCore;

  if (
    input.target === undefined &&
    (currentCore === MONOREPO_PROTOCOL ||
      manifest.notionxCore === MONOREPO_PROTOCOL ||
      manifest.compat?.mode === "legacy-vinext")
  ) {
    return {
      dryRun: Boolean(input.dryRun),
      targetCore: currentCore,
      changes: [],
      followup: [
        "This project is linked to the local monorepo. Re-run the scaffold/test sync flow instead of pulling npm semver.",
      ],
      skipped: `Detected ${MONOREPO_PROTOCOL}; core package metadata was left unchanged.`,
    };
  }

  const target = input.target ?? { kind: "dist-tag", tag: "latest" as const };
  const targetCore = await resolveCoreSpec(target);
  const targetCli = await resolveCliSpecIfPresent(packageJson, target);
  const changes: CoreUpdateChange[] = [];

  setDependency(nextPackageJson, CORE_PACKAGE, targetCore, changes);

  if (targetCli) {
    setDependency(nextPackageJson, CLI_PACKAGE, targetCli, changes, "devDependencies");
  }

  if (manifest.notionxCore !== targetCore) {
    changes.push({
      file: REGISTRY_FILE,
      field: "notionxCore",
      from: manifest.notionxCore,
      to: targetCore,
    });
  }

  if (!input.dryRun && changes.length > 0) {
    if (hasPackageJsonChange(changes)) {
      await writeFile(
        packagePath,
        `${JSON.stringify(nextPackageJson, null, 2)}\n`,
        "utf8",
      );
    }
    if (manifest.notionxCore !== targetCore) {
      await writeRegistryManifest(projectDir, {
        ...manifest,
        notionxCore: targetCore,
      });
    }
  }

  return {
    dryRun: Boolean(input.dryRun),
    targetCore,
    ...(targetCli ? { targetCli } : {}),
    changes,
    followup: buildFollowup(changes, Boolean(targetCli)),
  };
}

async function resolveCoreSpec(target: CoreUpdateTarget): Promise<string> {
  if (target.kind === "spec") return target.spec;
  const version = await fetchPackageDistTagVersion(CORE_PACKAGE, target.tag);
  return `^${version}`;
}

async function resolveCliSpecIfPresent(
  packageJson: PackageJson,
  target: CoreUpdateTarget,
): Promise<string | undefined> {
  if (target.kind !== "dist-tag") return undefined;
  if (!getDependency(packageJson, CLI_PACKAGE)) {
    return undefined;
  }
  const version = await fetchPackageDistTagVersion(CLI_PACKAGE, target.tag);
  return `^${version}`;
}

async function fetchPackageDistTagVersion(
  packageName: string,
  tag: CoreUpdateDistTag,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/${tag}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      throw new Error(`npm registry returned ${response.status}`);
    }
    const data = (await response.json()) as { version?: unknown };
    if (typeof data.version !== "string" || data.version.length === 0) {
      throw new Error("npm registry response did not include a version");
    }
    return data.version;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not resolve ${packageName}@${tag} from npm registry: ${message}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function getDependency(
  packageJson: PackageJson,
  packageName: string,
): string | undefined {
  const section = findDependencySection(packageJson, packageName);
  return section ? dependencyMap(packageJson, section)?.[packageName] : undefined;
}

function setDependency(
  packageJson: PackageJson,
  packageName: string,
  versionSpec: string,
  changes: CoreUpdateChange[],
  sectionOverride?: DependencySection,
): void {
  const section = sectionOverride ?? findDependencySection(packageJson, packageName) ?? "dependencies";
  const deps = dependencyMap(packageJson, section, true)!;
  const previous = deps[packageName] ?? null;
  if (previous === versionSpec) return;
  deps[packageName] = versionSpec;
  changes.push({
    file: "package.json",
    field: `${section}["${packageName}"]`,
    from: previous,
    to: versionSpec,
  });
}

function findDependencySection(
  packageJson: PackageJson,
  packageName: string,
): DependencySection | undefined {
  if (dependencyMap(packageJson, "dependencies")?.[packageName]) {
    return "dependencies";
  }
  if (dependencyMap(packageJson, "devDependencies")?.[packageName]) {
    return "devDependencies";
  }
  return undefined;
}

function dependencyMap(
  packageJson: PackageJson,
  section: DependencySection,
  create = false,
): Record<string, string> | undefined {
  const existing = packageJson[section];
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return existing as Record<string, string>;
  }
  if (!create) return undefined;
  packageJson[section] = {};
  return packageJson[section];
}

function hasPackageJsonChange(changes: readonly CoreUpdateChange[]): boolean {
  return changes.some((change) => change.file === "package.json");
}

function buildFollowup(
  changes: readonly CoreUpdateChange[],
  updatedCli: boolean,
): string[] {
  if (changes.length === 0) return ["Core package metadata is already aligned."];
  return [
    "Run `pnpm install` to refresh node_modules and the lockfile.",
    updatedCli
      ? "After install, run `pnpm exec notionx update --dry-run` with the updated CLI to preview scaffold/catalog changes."
      : "Run `pnpm exec notionx update --dry-run` to preview scaffold/catalog changes.",
    "Run `pnpm test && pnpm build` before deploying.",
  ];
}
