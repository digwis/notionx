/**
 * Load the notionx skill content from one of three sources:
 *
 * - `local`:  read from the monorepo's `skills/notionx/` (dev / CI)
 * - `npm`:    read from the package's bundled `skill/` directory (production)
 * - `github`: fetch raw files from `digwis/nextion` on GitHub
 *
 * The returned `SkillBundle` is then handed to the platform installers.
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SkillBundle, Source, Target } from "./types.js";
import { ALL_TARGETS } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Read a file as UTF-8 string, or undefined if missing. */
async function readText(path: string): Promise<string | undefined> {
  if (!existsSync(path)) return undefined;
  return await readFile(path, "utf8");
}

/** List `*.md` files in a directory and return them as a filename->content map. */
async function readMarkdownDir(
  dir: string,
): Promise<Record<string, string>> {
  if (!existsSync(dir)) return {};
  const entries = await readdir(dir, { withFileTypes: true });
  const out: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const content = await readText(resolve(dir, entry.name));
    if (typeof content === "string") {
      out[entry.name.replace(/\.md$/, "")] = content;
    }
  }
  return out;
}

/**
 * Read a skill from a directory. The directory must contain a `SKILL.md` and
 * may contain a `references/` and `rules/` subdirectory. Used by both `local`
 * and `npm` sources.
 */
async function loadFromDir(
  dir: string,
  version: string,
): Promise<SkillBundle> {
  const skill = (await readText(resolve(dir, "SKILL.md"))) ?? "";
  const references = await readMarkdownDir(resolve(dir, "references"));
  const rules: Record<Target, string> = {
    claude: skill, // Claude / Trae use the SKILL.md itself, not a separate rule.
    codex: (await readText(resolve(dir, "rules", "codex.md"))) ?? "",
    trae: skill,
  };
  const installGuide =
    (await readText(resolve(dir, "INSTALL.md"))) ?? "";

  if (!skill) {
    throw new Error(`No SKILL.md found in ${dir}; refusing to install.`);
  }

  return { skill, references, rules, installGuide, version };
}

/** Resolve the bundled skill directory (the `skill/` folder shipped with the npm package). */
function bundledSkillDir(): string {
  // This file lives at packages/nextion-skill/src/skill-source.ts
  // At build time, `dist/skill-source.js` ships alongside `skill/`.
  return resolve(__dirname, "..", "skill");
}

/** Resolve the local monorepo skill directory (used during development). */
function localSkillDir(): string {
  // dist/skill-source.js -> packages/nextion-skill/src/skill-source.ts
  // Walk up to repo root, then into skills/notionx.
  return resolve(__dirname, "..", "..", "..", "skills", "notionx");
}

/** Load the skill from a local directory (monorepo dev mode). */
export async function loadLocal(version: string): Promise<SkillBundle> {
  const dir = localSkillDir();
  if (!existsSync(resolve(dir, "SKILL.md"))) {
    throw new Error(
      `Local skill source not found at ${dir}. ` +
        `Run from inside the notionx monorepo, or use --source=npm.`,
    );
  }
  return await loadFromDir(dir, version);
}

/** Load the skill from the bundled `skill/` directory inside the npm package. */
export async function loadBundled(version: string): Promise<SkillBundle> {
  const dir = bundledSkillDir();
  if (!existsSync(resolve(dir, "SKILL.md"))) {
    throw new Error(
      `Bundled skill content missing at ${dir}. ` +
        `This usually means the package was published without running the sync-bundled-skill script. ` +
        `Please report this at https://github.com/digwis/nextion/issues.`,
    );
  }
  return await loadFromDir(dir, version);
}

/**
 * Load the skill by fetching raw files from the notionx GitHub repository.
 * Useful when a user wants the latest unreleased skill content.
 */
export async function loadFromGithub(
  ref: string = "main",
  version: string = `github:${ref}`,
): Promise<SkillBundle> {
  const base = `https://raw.githubusercontent.com/digwis/nextion/${ref}/skills/notionx`;
  const fetchText = async (path: string): Promise<string> => {
    const res = await fetch(`${base}/${path}`);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${base}/${path}: ${res.status} ${res.statusText}`,
      );
    }
    return await res.text();
  };

  const skill = await fetchText("SKILL.md");
  const installGuide = await fetchText("INSTALL.md");

  const references: Record<string, string> = {};
  for (const name of [
    "architecture",
    "content-source",
    "domain-module",
    "deploy",
    "troubleshooting",
    "four-contracts",
  ]) {
    try {
      references[name] = await fetchText(`references/${name}.md`);
    } catch {
      // Reference is optional; ignore 404s.
    }
  }

  const rules: Record<Target, string> = {
    claude: skill,
    codex: await fetchText("rules/codex.md"),
    trae: skill,
  };

  return { skill, references, rules, installGuide, version };
}

/** Public dispatcher. */
export async function loadSkill(
  source: Source,
  opts: { githubRef?: string; version: string },
): Promise<SkillBundle> {
  switch (source) {
    case "local":
      return await loadLocal(opts.version);
    case "npm":
      return await loadBundled(opts.version);
    case "github":
      return await loadFromGithub(opts.githubRef, opts.version);
    default: {
      const exhaustive: never = source;
      throw new Error(`Unknown source: ${String(exhaustive)}`);
    }
  }
}

/** Re-export for convenience. */
export { ALL_TARGETS };
