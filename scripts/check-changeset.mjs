#!/usr/bin/env node
// scripts/check-changeset.mjs
//
// Predict whether the next `git push origin <branch>` (default: main) will
// trigger the release workflow to publish packages to npm.
//
// Logic:
//   1. Compute the diff between HEAD and the upstream of the branch we're
//      about to push to (origin/<target>). If that ref doesn't exist
//      (e.g. first push of a new branch), fall back to origin/main.
//   2. Categorise every changed file:
//        - "code"   → under packages/<name>/{src,templates,scripts,tests}
//        - "ci"     → .github/**, .husky/**, scripts/check-changeset.mjs,
//                     .changeset/**, package.json (root), pnpm-lock.yaml
//        - "docs"   → *.md, docs/**
//        - "infra"  → everything else
//   3. Check whether any .changeset/*.md (excluding README.md) is part of
//      the diff as an addition or modification.
//   4. Decide:
//        - If no code changes                  → "no publish, push is fine"
//        - If code changes AND a changeset     → "will publish: <list>"
//        - If code changes AND no changeset    → exit 1 with a clear message
//
// Exit codes:
//   0  – push is allowed (either no publish needed, or publish is correctly
//        set up via a changeset)
//   1  – push would NOT publish but code changed; user must add a changeset
//   2  – unexpected error (e.g. git command failed)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

// Diff base resolution priority:
//   1. NOTIONX_DIFF_BASE env var (set by .husky/pre-push with the actual
//      remote ref git is about to push to) — but only if that ref exists
//   2. origin/<current-branch> (when running the script manually from a
//      feature branch)
//   3. origin/main (when on main, or when the feature branch has no
//      matching remote ref)
function resolveDiffBase() {
  if (process.env.NOTIONX_DIFF_BASE) {
    const ref = process.env.NOTIONX_DIFF_BASE;
    if (tryGit("rev-parse", "--verify", ref) !== null) {
      return ref;
    }
    // The ref we were told to use doesn't exist (e.g. a brand-new branch
    // being pushed for the first time). Fall through to a default.
  }
  const currentBranch = tryGit("branch", "--show-current");
  if (currentBranch) {
    const ref = `origin/${currentBranch}`;
    if (tryGit("rev-parse", "--verify", ref) !== null) {
      return ref;
    }
  }
  if (tryGit("rev-parse", "--verify", "origin/main") !== null) {
    return "origin/main";
  }
  return null;
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}

function listChangedFiles(diffBase) {
  if (!diffBase) return null;
  const out = git("diff", "--name-status", `${diffBase}...HEAD`);
  if (!out) return [];
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status, path: rest.join("\t") };
    });
}

const PACKAGE_DIR_TO_NAME = {
  nextion: "@notionx/core",
  "create-nextion-app": "@notionx/create-notionx-app",
  "create-nextion-app-shim": "create-notionx",
  "nextion-skill": "@notionx/skill",
};

function categorize(file) {
  const p = file.path;
  if (p.startsWith("packages/")) {
    const parts = p.split("/");
    const pkg = parts[1];
    if (parts.length >= 3) {
      const sub = parts[2];
      if (
        [
          "src",
          "templates",
          "scripts",
          "tests",
          "package.json",
        ].includes(sub) ||
        p.endsWith("/package.json")
      ) {
        return { kind: "code", pkg: PACKAGE_DIR_TO_NAME[pkg] ?? pkg };
      }
    }
    return { kind: "ci", pkg: PACKAGE_DIR_TO_NAME[pkg] ?? pkg };
  }
  if (
    p.startsWith(".github/") ||
    p.startsWith(".husky/") ||
    p.startsWith(".changeset/") ||
    p === "package.json" ||
    p === "pnpm-lock.yaml" ||
    p === "pnpm-workspace.yaml" ||
    p === "scripts/check-changeset.mjs" ||
    p === "scripts/publish-packages.mjs"
  ) {
    return { kind: "ci" };
  }
  if (p.endsWith(".md") || p.startsWith("docs/")) {
    return { kind: "docs" };
  }
  return { kind: "infra" };
}

function isChangesetFile(p) {
  return (
    p.startsWith(".changeset/") &&
    p.endsWith(".md") &&
    !p.endsWith("/README.md")
  );
}

function hasChangesetAdded(files) {
  return files.some(
    (f) => isChangesetFile(f.path) && (f.status === "A" || f.status === "M")
  );
}

function currentVersions() {
  // Read versions straight from package.json so the message matches what
  // changesets will bump to.
  const versions = {};
  for (const [dir, name] of Object.entries(PACKAGE_DIR_TO_NAME)) {
    const raw = readFileSync(resolve(ROOT, "packages", dir, "package.json"), "utf8");
    versions[name] = JSON.parse(raw).version;
  }
  return versions;
}

function main() {
  const diffBase = resolveDiffBase();

  if (!diffBase) {
    console.log(
      "[check-changeset] No upstream ref found; cannot predict. Push will proceed."
    );
    process.exit(0);
  }

  const files = listChangedFiles(diffBase) ?? [];

  if (files.length === 0) {
    console.log("[check-changeset] No commits to push.");
    process.exit(0);
  }

  const codeByPkg = new Map();
  for (const f of files) {
    const cat = categorize(f);
    if (cat.kind === "code" && cat.pkg) {
      codeByPkg.set(cat.pkg, (codeByPkg.get(cat.pkg) ?? 0) + 1);
    }
  }

  const hasChangeset = hasChangesetAdded(files);

  if (codeByPkg.size === 0) {
    console.log(
      `[check-changeset] Push contains no package code changes ` +
        `(only docs/CI/infra). npm publish will NOT run.`
    );
    process.exit(0);
  }

  if (!hasChangeset) {
    const versions = currentVersions();
    const lines = [
      "",
      "  ✗  npm publish will NOT run for this push.",
      "",
      "    Code changed in:",
      ...[...codeByPkg.entries()].map(
        ([pkg, n]) => `      - ${pkg} (${n} file${n === 1 ? "" : "s"})  [current: ${versions[pkg] ?? "?"}]`
      ),
      "",
      "    No changeset was added or modified.",
      "",
      "    Add one before pushing:",
      "",
      "      pnpm changeset              # interactive",
      '      # or write .changeset/<name>.md directly:',
      "      # ---",
      '      # "@notionx/<pkg>": patch   # or minor / major',
      "      # ---",
      "      # describe the change here",
      "",
      "    Bump guide:",
      "      patch  → bug fix / docs / refactor",
      "      minor  → new feature, backwards-compatible",
      "      major  → breaking change",
      "",
      "    To skip this check (NOT recommended):",
      "      git push --no-verify origin HEAD",
      "",
    ];
    console.error(lines.join("\n"));
    process.exit(1);
  }

  // Has both code changes and a changeset → publish will run.
  const versions = currentVersions();
  const pkgList = [...codeByPkg.keys()]
    .map((pkg) => `${pkg} (${versions[pkg] ?? "?"} → ?)`)
    .join(", ");
  console.log("");
  console.log("  ✓  npm publish WILL run for this push.");
  console.log("");
  console.log(`    Packages to bump: ${pkgList}`);
  console.log("");
  console.log("    What the release workflow will do:");
  console.log("      1. pnpm install --frozen-lockfile");
  console.log("      2. build all buildable packages");
  console.log("      3. pnpm changeset version   (bumps versions, deletes .changeset/*.md)");
  console.log("      4. commit + push 'chore(release): version packages' to main");
  console.log("      5. node scripts/publish-packages.mjs");
  console.log("");
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error("[check-changeset] unexpected error:", err.message);
  process.exit(2);
}
