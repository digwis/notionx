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
    const codexHome = process.env.CODEX_HOME?.trim()
      ? resolve(process.env.CODEX_HOME)
      : join(home, ".codex");
    switch (target) {
      case "claude":
        return join(home, ".claude", "skills", "notionx");
      case "trae":
        return join(home, ".trae", "skills", "notionx");
      case "trae-cn":
        return join(home, ".trae-cn", "skills", "notionx");
      case "codex":
        return join(codexHome, "skills", "notionx");
      case "shared":
        return join(home, ".agents", "skills", "notionx");
      case "codex-rules":
        return codexHome;
    }
  }
  // scope === "project"
  switch (target) {
    case "claude":
      return join(cwd, ".claude", "skills", "notionx");
    case "trae":
    case "trae-cn":
      return join(cwd, ".trae", "skills", "notionx");
    case "codex":
    case "shared":
      return join(cwd, ".agents", "skills", "notionx");
    case "codex-rules":
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
  if (bundle.openaiYaml) {
    files.push({ path: join(baseDir, "agents", "openai.yaml"), content: bundle.openaiYaml });
  }
  for (const [name, content] of Object.entries(bundle.references)) {
    files.push({ path: join(baseDir, "references", `${name}.md`), content });
  }
  return files;
}

/** Install a full SKILL.md directory for agents that read the common format. */
export async function installDirectoryTarget(
  target: Target,
  bundle: SkillBundle,
  opts: { scope: Scope; cwd: string; force?: boolean; dryRun?: boolean },
): Promise<{
  target: Target;
  scope: Scope;
  filesWritten: FileWrite[];
  filesSkipped: FileSkip[];
}> {
  const baseDir = resolveBaseDir(target, opts.scope, opts.cwd);
  const files = planDirectoryFiles(baseDir, bundle);

  const written: FileWrite[] = [];
  const skipped: FileSkip[] = [];

  for (const file of files) {
    const result = await writeUnlessExists(file.path, file.content, opts);
    if ("bytes" in result) {
      written.push(result);
    } else {
      skipped.push(result);
    }
  }

  return {
    target,
    scope: opts.scope,
    filesWritten: written,
    filesSkipped: skipped,
  };
}

/** Resolve and validate a working directory for project-scope installs. */
export function resolveCwd(cwd: string | undefined): string {
  const dir = resolve(cwd ?? process.cwd());
  if (!existsSync(dir)) {
    throw new Error(`Working directory does not exist: ${dir}`);
  }
  return dir;
}
