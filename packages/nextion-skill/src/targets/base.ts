/**
 * Helpers shared by the platform-specific installers.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

import type {
  FileSkip,
  FileWrite,
  Scope,
  SkillBundle,
  Target,
} from "../types.js";

/** Resolve the base directory for a given (target, scope) pair. */
export function resolveBaseDir(target: Target, scope: Scope, cwd: string): string {
  if (scope === "user") {
    const home = homedir();
    switch (target) {
      case "claude":
        return join(home, ".claude", "skills", "nextion");
      case "trae":
        return join(home, ".trae", "skills", "nextion");
      case "codex":
        return join(home, ".codex");
    }
  }
  // scope === "project"
  switch (target) {
    case "claude":
      return join(cwd, ".claude", "skills", "nextion");
    case "trae":
      return join(cwd, ".trae", "skills", "nextion");
    case "codex":
      // AGENTS.md lives at the repo root.
      return cwd;
  }
}

/** Write a file, creating parent directories as needed. Returns bytes written. */
export async function writeUtf8(
  filePath: string,
  content: string,
): Promise<number> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  return Buffer.byteLength(content, "utf8");
}

/**
 * Write `content` to `filePath` unless it already exists and `force` is false.
 * Returns a `FileWrite` (when written) or a `FileSkip` (when skipped).
 */
export async function writeUnlessExists(
  filePath: string,
  content: string,
  opts: { force?: boolean; dryRun?: boolean },
): Promise<FileWrite | FileSkip> {
  const exists = existsSync(filePath);
  if (exists && !opts.force) {
    return {
      path: filePath,
      reason: "already exists (use --force to overwrite)",
    };
  }
  if (opts.dryRun) {
    return {
      path: filePath,
      bytes: Buffer.byteLength(content, "utf8"),
    };
  }
  const bytes = await writeUtf8(filePath, content);
  return { path: filePath, bytes };
}

/** Build the list of files a target wants to write, given a skill bundle. */
export interface PlannedFile {
  /** Absolute path. */
  path: string;
  /** File content. */
  content: string;
}

/** Targets that take a full directory of files (Claude / Trae). */
export function planDirectoryFiles(
  baseDir: string,
  bundle: SkillBundle,
): PlannedFile[] {
  const files: PlannedFile[] = [
    { path: join(baseDir, "SKILL.md"), content: bundle.skill },
    { path: join(baseDir, "INSTALL.md"), content: bundle.installGuide },
  ];
  for (const [name, content] of Object.entries(bundle.references)) {
    files.push({ path: join(baseDir, "references", `${name}.md`), content });
  }
  return files;
}

/** Resolve and validate a working directory for project-scope installs. */
export function resolveCwd(cwd: string | undefined): string {
  const dir = resolve(cwd ?? process.cwd());
  if (!existsSync(dir)) {
    throw new Error(`Working directory does not exist: ${dir}`);
  }
  return dir;
}
