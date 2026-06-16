/**
 * OpenAI Codex installer: writes the notionx rule to `AGENTS.md`.
 *
 * Codex's project-level AGENTS.md is a *shared* conventions file. We do not
 * silently overwrite it. Instead:
 *
 *   - If the file does not exist, create it with the notionx content as the
 *     full body.
 *   - If the file exists and the notionx section is not already there,
 *     **append** a `## notionx` section.
 *   - If the file exists and the notionx section is already there, skip
 *     (idempotent re-runs).
 *   - If `--force` is set, overwrite the whole file.
 *
 * Both `~/.codex/AGENTS.md` (user scope) and `./AGENTS.md` (project scope)
 * are supported. The user-scope path lives under `~/.codex/`, so we need
 * to `mkdir -p` for that one.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

import type { InstallResult, Scope, SkillBundle } from "../types.js";
import { writeUtf8, writeUnlessExists } from "./base.js";

export interface InstallCodexOptions {
  scope: Scope;
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
}

/** Filename Codex reads for agent instructions. */
const CODEX_AGENTS_FILE = "AGENTS.md";

/** Marker we use to detect a previously-installed notionx section. */
const NOTIONX_SECTION_HEADER = "## notionx";

/** Resolve the full path to the AGENTS.md file. */
function resolveAgentsPath(scope: Scope, cwd: string): string {
  if (scope === "user") {
    return join(homedir(), ".codex", CODEX_AGENTS_FILE);
  }
  return join(cwd, CODEX_AGENTS_FILE);
}

/**
 * Build the body to write for a brand-new file (file does not exist).
 */
function buildFreshBody(content: string): string {
  // The rule file is already a complete markdown document; just emit it.
  return content.endsWith("\n") ? content : `${content}\n`;
}

/**
 * Build the body to *append* to an existing AGENTS.md.
 * Includes a leading separator and the section header.
 */
function buildAppendedSection(content: string): string {
  const trimmed = content.endsWith("\n") ? content : `${content}\n`;
  // Two newlines before the header so we get a clean section break.
  return `\n${NOTIONX_SECTION_HEADER}\n\n${trimmed}`;
}

/**
 * Check whether `body` already contains a notionx section. We use a
 * heuristic: the literal `## notionx` header (case-insensitive, allowing
 * for trailing whitespace / extra # levels).
 */
function hasNotionxSection(body: string): boolean {
  return /(^|\n)#{1,6}\s+notionx\b/i.test(body);
}

export async function installCodex(
  bundle: SkillBundle,
  opts: InstallCodexOptions,
): Promise<InstallResult> {
  const filePath = resolve(resolveAgentsPath(opts.scope, opts.cwd));
  const content = bundle.rules.codex;

  const written: InstallResult["filesWritten"] = [];
  const skipped: InstallResult["filesSkipped"] = [];

  // Force path: overwrite the whole file (parent dirs already exist for
  // project scope, user scope requires mkdir).
  if (opts.force) {
    const result = await writeUnlessExists(filePath, buildFreshBody(content), {
      force: true,
      dryRun: opts.dryRun,
    });
    if ("bytes" in result) {
      written.push(result);
    } else {
      skipped.push(result);
    }
    return { target: "codex", scope: opts.scope, filesWritten: written, filesSkipped: skipped };
  }

  // No-force path: branch on whether the file exists.
  if (!existsSync(filePath)) {
    // Brand new file: create with the notionx content.
    const result = await writeUnlessExists(filePath, buildFreshBody(content), {
      dryRun: opts.dryRun,
    });
    if ("bytes" in result) {
      written.push(result);
    } else {
      skipped.push(result);
    }
    return { target: "codex", scope: opts.scope, filesWritten: written, filesSkipped: skipped };
  }

  // File exists. Read it and check whether notionx is already there.
  let existing = "";
  if (!opts.dryRun) {
    existing = await readFile(filePath, "utf8");
  } else {
    // In dry-run we don't want to read user files; pretend it's empty so
    // the plan says "would append".
    existing = "";
  }

  if (hasNotionxSection(existing)) {
    skipped.push({
      path: filePath,
      reason: "notionx section already present in AGENTS.md (use --force to overwrite)",
    });
    return { target: "codex", scope: opts.scope, filesWritten: written, filesSkipped: skipped };
  }

  if (opts.dryRun) {
    const appended = buildAppendedSection(content);
    written.push({
      path: filePath,
      bytes: Buffer.byteLength(existing, "utf8") + Buffer.byteLength(appended, "utf8"),
    });
    return { target: "codex", scope: opts.scope, filesWritten: written, filesSkipped: skipped };
  }

  const appended = buildAppendedSection(content);
  const newBody = `${existing}${existing.endsWith("\n") ? "" : "\n"}${appended}`;
  const bytes = await writeUtf8(filePath, newBody);
  written.push({ path: filePath, bytes });

  return { target: "codex", scope: opts.scope, filesWritten: written, filesSkipped: skipped };
}
