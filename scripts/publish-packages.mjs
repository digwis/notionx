import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const currentFile = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(currentFile);
const repoRoot = path.resolve(scriptsDir, "..");

export const RELEASE_PACKAGES = [
  {
    name: "@notionx/core",
    directory: "packages/nextion",
  },
  {
    name: "@notionx/create-nextion-app",
    directory: "packages/create-nextion-app",
  },
  {
    name: "create-nextion",
    directory: "packages/create-nextion-app-shim",
  },
  {
    name: "@notionx/skill",
    directory: "packages/nextion-skill",
  },
];

export function planPublications(packages, publishedVersions) {
  const alreadyPublished = [];
  const toPublish = [];

  for (const pkg of packages) {
    const key = `${pkg.name}@${pkg.version}`;
    if (publishedVersions.has(key)) {
      alreadyPublished.push(pkg);
      continue;
    }
    toPublish.push(pkg);
  }

  return { alreadyPublished, toPublish };
}

async function readPackageVersion(packageDirectory) {
  const packageJson = JSON.parse(
    await readFile(path.join(repoRoot, packageDirectory, "package.json"), "utf8")
  );
  return packageJson.version;
}

async function loadReleasePackages() {
  return Promise.all(
    RELEASE_PACKAGES.map(async (pkg) => ({
      ...pkg,
      version: await readPackageVersion(pkg.directory),
    }))
  );
}

async function isPublishedVersion(pkg) {
  try {
    await execFileAsync("npm", ["view", `${pkg.name}@${pkg.version}`, "version"], {
      cwd: repoRoot,
    });
    return true;
  } catch (error) {
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    if (output.includes("E404") || output.includes("404")) {
      return false;
    }
    throw error;
  }
}

async function getPublishedVersions(packages) {
  const publishedVersions = new Set();

  for (const pkg of packages) {
    if (await isPublishedVersion(pkg)) {
      publishedVersions.add(`${pkg.name}@${pkg.version}`);
    }
  }

  return publishedVersions;
}

async function publishPackage(pkg) {
  console.log(`Publishing ${pkg.name}@${pkg.version}`);
  const { stdout, stderr } = await execFileAsync(
    "pnpm",
    ["--filter", pkg.name, "publish", "--no-git-checks", "--tag", "latest"],
    { cwd: repoRoot }
  );

  if (stdout.trim()) {
    process.stdout.write(stdout);
    if (!stdout.endsWith("\n")) console.log();
  }
  if (stderr.trim()) {
    process.stderr.write(stderr);
    if (!stderr.endsWith("\n")) console.error();
  }
}

export async function main() {
  const packages = await loadReleasePackages();
  const publishedVersions = await getPublishedVersions(packages);
  const plan = planPublications(packages, publishedVersions);

  for (const pkg of plan.alreadyPublished) {
    console.log(`Skipping ${pkg.name}@${pkg.version} because it is already on npm.`);
  }

  for (const pkg of plan.toPublish) {
    await publishPackage(pkg);
  }

  if (!plan.toPublish.length) {
    console.log("No unpublished package versions remain.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
