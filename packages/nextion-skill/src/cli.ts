#!/usr/bin/env node
/**
 * CLI entry point for `nextion-skill`.
 *
 * Usage:
 *   nextion-skill install --target <claude|trae|cursor|windsurf|copilot|all>
 *                        [--scope <user|project>]
 *                        [--source <local|github|npm>]
 *                        [--ref <github-ref>]
 *                        [--force] [--dry-run] [--cwd <path>]
 *
 *   nextion-skill uninstall --target <...> [--scope <...>] [--cwd <path>]
 *
 *   nextion-skill info
 *
 * No external CLI parser — kept dependency-free on purpose.
 */
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runInstall } from "./install.js";
import { ALL_TARGETS, isTarget } from "./types.js";
import type { Scope, Source, Target } from "./types.js";
import { resolveBaseDir } from "./targets/base.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HELP = `nextion-skill — install the official nextion AI agent skill

USAGE
  nextion-skill <command> [options]

COMMANDS
  install     Install the skill (default if no command given)
  uninstall   Remove installed files
  info        Show where the skill would be installed for each target
  help        Show this help

OPTIONS (install / uninstall)
  --target <id>         claude | trae | codex | cursor | windsurf | copilot | all  (default: all)
  --scope <scope>       user | project                                     (default: user)
  --source <source>     local | github | npm                               (default: npm)
  --ref <git-ref>       GitHub ref when --source=github                    (default: main)
  --cwd <path>          Working dir for project scope                      (default: $PWD)
  --force               Overwrite existing files
  --dry-run             Print what would be written; don't touch disk
  --json                Machine-readable output

EXAMPLES
  # Install the skill for Claude Code globally:
  npx nextion-skill install --target claude --scope user

  # Install for every supported editor, project-scope, from the npm package:
  npx nextion-skill install --target all --scope project

  # Try the latest skill from main branch (requires network):
  npx nextion-skill install --target claude --source github --ref main

  # See where files would go without writing:
  npx nextion-skill info

For a manual install per editor, see:
  https://github.com/digwis/nextion/blob/main/skills/nextion/INSTALL.md
`;

// -------- arg parsing -----------------------------------------------------

type ParsedArgs = {
  command: "install" | "uninstall" | "info" | "help";
  target: Target | "all";
  scope: Scope;
  source: Source;
  ref: string;
  cwd: string;
  force: boolean;
  dryRun: boolean;
  json: boolean;
  showHelp: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: "install",
    target: "all",
    scope: "user",
    source: "npm",
    ref: "main",
    cwd: process.cwd(),
    force: false,
    dryRun: false,
    json: false,
    showHelp: false,
  };

  let i = 0;
  // First non-flag arg is the command.
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === undefined) break;

    if (!arg.startsWith("--")) {
      if (result.command === "install") {
        if (arg === "install" || arg === "uninstall" || arg === "info" || arg === "help") {
          result.command = arg;
        } else {
          throw new Error(`Unknown command: ${arg}`);
        }
      }
      i++;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    const consume = (val: string) => {
      i += 2;
      return val;
    };

    switch (key) {
      case "target": {
        const v = consume(next ?? "");
        if (v === "all" || isTarget(v)) {
          result.target = v;
        } else {
          throw new Error(
            `Invalid --target: ${v}. Expected one of: ${[...ALL_TARGETS, "all"].join(", ")}.`,
          );
        }
        break;
      }
      case "scope": {
        const v = consume(next ?? "");
        if (v === "user" || v === "project") {
          result.scope = v;
        } else {
          throw new Error(`Invalid --scope: ${v}. Expected 'user' or 'project'.`);
        }
        break;
      }
      case "source": {
        const v = consume(next ?? "");
        if (v === "local" || v === "github" || v === "npm") {
          result.source = v;
        } else {
          throw new Error(`Invalid --source: ${v}. Expected 'local', 'github', or 'npm'.`);
        }
        break;
      }
      case "ref": {
        result.ref = consume(next ?? "");
        break;
      }
      case "cwd": {
        result.cwd = resolve(consume(next ?? ""));
        break;
      }
      case "force":
        result.force = true;
        i++;
        break;
      case "dry-run":
        result.dryRun = true;
        i++;
        break;
      case "json":
        result.json = true;
        i++;
        break;
      case "help":
      case "h":
        result.showHelp = true;
        i++;
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }

  return result;
}

// -------- command implementations ----------------------------------------

function describePaths(scope: Scope, cwd: string): Array<{ target: Target; paths: string[] }> {
  return ALL_TARGETS.map((target) => {
    const base = resolveBaseDir(target, scope, cwd);
    if (target === "codex") {
      // Codex reads a single AGENTS.md.
      return { target, paths: [resolve(base, "AGENTS.md")] };
    }
    if (target === "cursor" || target === "windsurf" || target === "copilot") {
      const filename =
        target === "copilot" ? "copilot-instructions.md" : `${target === "cursor" ? "nextion" : "nextion"}.${target === "cursor" ? "mdc" : "md"}`;
      return { target, paths: [resolve(base, filename)] };
    }
    return {
      target,
      paths: [
        resolve(base, "SKILL.md"),
        resolve(base, "INSTALL.md"),
        resolve(base, "references"),
      ],
    };
  });
}

async function runInfo(args: ParsedArgs): Promise<number> {
  const targets = args.target === "all" ? [...ALL_TARGETS] : [args.target as Target];
  const allPaths = describePaths(args.scope, args.cwd);
  const filtered = allPaths.filter((p) => targets.includes(p.target));

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          version: "see package.json",
          source: args.source,
          scope: args.scope,
          cwd: args.cwd,
          targets: filtered,
        },
        null,
        2,
      ) + "\n",
    );
    return 0;
  }

  console.log("nextion-skill install plan:");
  console.log(`  source: ${args.source}`);
  console.log(`  scope:  ${args.scope}`);
  console.log(`  cwd:    ${args.cwd}`);
  console.log("");
  for (const { target, paths } of filtered) {
    console.log(`  [${target}]`);
    for (const p of paths) {
      const exists = existsSync(p);
      const mark = exists ? "✓" : "·";
      console.log(`    ${mark} ${p}`);
    }
  }
  return 0;
}

async function runUninstall(args: ParsedArgs): Promise<number> {
  const targets = args.target === "all" ? [...ALL_TARGETS] : [args.target as Target];
  const removed: string[] = [];
  const missing: string[] = [];
  const manualEdits: string[] = [];

  for (const target of targets) {
    if (target === "codex") {
      // Codex's AGENTS.md is a shared file; we never auto-delete it.
      // We only remind the user which file to edit.
      const base = resolveBaseDir("codex", args.scope, args.cwd);
      const file = resolve(base, "AGENTS.md");
      if (existsSync(file)) {
        manualEdits.push(
          `codex: edit ${file} and remove the "## nextion" section`,
        );
      } else {
        missing.push(file);
      }
      continue;
    }

    const base = resolveBaseDir(target, args.scope, args.cwd);
    if (target === "cursor" || target === "windsurf" || target === "copilot") {
      const filename =
        target === "copilot" ? "copilot-instructions.md" : target === "cursor" ? "nextion.mdc" : "nextion.md";
      const file = resolve(base, filename);
      if (existsSync(file)) {
        if (!args.dryRun) await rm(file, { force: true });
        removed.push(file);
      } else {
        missing.push(file);
      }
    } else {
      // claude / trae: full directory
      if (existsSync(base)) {
        if (!args.dryRun) await rm(base, { recursive: true, force: true });
        removed.push(base);
      } else {
        missing.push(base);
      }
    }
  }

  if (args.json) {
    process.stdout.write(
      JSON.stringify({ removed, missing, manualEdits }, null, 2) + "\n",
    );
    return 0;
  }

  for (const p of removed) console.log(`removed: ${p}`);
  for (const p of missing) console.log(`missing: ${p}`);
  for (const p of manualEdits) console.log(`manual: ${p}`);
  return 0;
}

async function runInstallCmd(args: ParsedArgs): Promise<number> {
  const { bundle, results } = await runInstall({
    target: args.target,
    scope: args.scope,
    source: args.source,
    cwd: args.cwd,
    force: args.force,
    dryRun: args.dryRun,
    githubRef: args.ref,
  });

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          version: bundle.version,
          source: args.source,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    return 0;
  }

  console.log(`Installed nextion skill v${bundle.version} (source: ${args.source})`);
  if (args.dryRun) console.log("(dry run; nothing was actually written)");

  for (const r of results) {
    console.log(`\n  [${r.target}] (${r.scope})`);
    for (const f of r.filesWritten) {
      console.log(`    + ${f.path}  (${f.bytes} bytes)`);
    }
    for (const f of r.filesSkipped) {
      console.log(`    · ${f.path}  (skipped: ${f.reason})`);
    }
  }

  return 0;
}

// -------- main ------------------------------------------------------------

async function main(): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n\n${HELP}`);
    return 2;
  }

  if (args.showHelp || args.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }

  try {
    switch (args.command) {
      case "install":
        return await runInstallCmd(args);
      case "uninstall":
        return await runUninstall(args);
      case "info":
        return await runInfo(args);
    }
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    return 1;
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`Fatal: ${(err as Error).message}\n`);
    process.exit(1);
  });
