// tools/create-vinext-app/src/answers.ts
//
// Build an `Answers` object either from the interactive prompt or
// from CLI flags. The CLI flow exists so the scaffolder can run in
// CI / non-TTY smoke tests where `@clack/prompts` would just hang.

import * as p from "@clack/prompts";
import type { Answers, AnswersContentField } from "./prompt.js";

interface CliOverrides {
  projectName?: string;
  targetDir?: string;
  defaultLocale?: string;
  supportedLocales?: string;
  contentId?: string;
  contentTitle?: string;
  fields?: string;
  foundationSource?: string;
  yes?: boolean;
}

const DEFAULT_FIELDS = "Title, Slug, Description";

function parseLocales(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function toCamelCase(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  if (!cleaned) return "field";
  const parts = cleaned.split(/\s+/);
  const [first, ...rest] = parts;
  return (
    first.toLowerCase() +
    rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")
  );
}

function buildFields(raw: string): AnswersContentField[] {
  const names = parseLocales(raw);
  const seen = new Set<string>();
  const out: AnswersContentField[] = [];
  for (const name of names.length ? names : ["Title"]) {
    const key = toCamelCase(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, notionName: name });
  }
  return out;
}

function parseArgs(argv: string[]): CliOverrides {
  const out: CliOverrides = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    const takeNext = (value: string | undefined) => {
      if (value === undefined) {
        throw new Error(`Flag ${arg} requires a value`);
      }
      return value;
    };
    switch (arg) {
      case "--project-name":
        out.projectName = takeNext(next);
        i++;
        break;
      case "--target-dir":
        out.targetDir = takeNext(next);
        i++;
        break;
      case "--default-locale":
        out.defaultLocale = takeNext(next);
        i++;
        break;
      case "--supported-locales":
        out.supportedLocales = takeNext(next);
        i++;
        break;
      case "--content-id":
        out.contentId = takeNext(next);
        i++;
        break;
      case "--content-title":
        out.contentTitle = takeNext(next);
        i++;
        break;
      case "--fields":
        out.fields = takeNext(next);
        i++;
        break;
      case "--foundation-source":
        out.foundationSource = takeNext(next);
        i++;
        break;
      case "-y":
      case "--yes":
        out.yes = true;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        // First positional arg is the target dir.
        if (!out.targetDir) {
          out.targetDir = arg;
        }
        break;
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`create-vinext-app — scaffold a new vinext project

Usage:
  create-vinext-app [target-dir] [flags]

Flags:
  --project-name <name>        Project name (kebab/lower case)
  --target-dir <dir>           Output directory
  --default-locale <locale>    Default locale (default: en)
  --supported-locales <list>   Comma- or space-separated locales (default: en)
  --content-id <id>            First content source id (default: blog)
  --content-title <title>      First content source title (default: Blog)
  --fields <names>             Field names, comma-separated
                               (default: "Title, Slug, Description")
  -y, --yes                    Skip the confirmation prompt
      --foundation-source <spec>    Override the @vinext/foundation dep value
                                   (default: "workspace:*"). Examples:
                                     "link:../vinext-monorepo/packages/foundation"
                                     "file:../vinext-monorepo/packages/foundation"
                                     "^1.0.0" (for published consumption)
  -h, --help                   Print this help
`);
}

function applyDefaults(overrides: CliOverrides, argv: string[]): Answers {
  const projectName = overrides.projectName ?? "my-vinext-app";
  const targetDir =
    overrides.targetDir ?? argv[2] ?? `./${projectName}`;
  const defaultLocale = overrides.defaultLocale ?? "en";
  const supportedLocales = parseLocales(
    overrides.supportedLocales ?? defaultLocale
  );
  const contentId = overrides.contentId ?? "blog";
  const contentTitle =
    overrides.contentTitle ?? contentId.charAt(0).toUpperCase() + contentId.slice(1);
  const fields = buildFields(overrides.fields ?? DEFAULT_FIELDS);
  return {
    projectName,
    targetDir,
    defaultLocale,
    supportedLocales: supportedLocales.length
      ? Array.from(new Set([defaultLocale, ...supportedLocales]))
      : [defaultLocale],
    foundationSource: overrides.foundationSource ?? "workspace:*",
    contentSource: {
      id: contentId,
      title: contentTitle,
      fields,
    },
  };
}

/**
 * Entry point. Resolves answers from CLI flags first; falls back to
 * the interactive prompt when the user did not pass `--yes`.
 */
export async function gatherAnswers(
  argv: string[] = process.argv
): Promise<Answers> {
  const cli = parseArgs(argv);

  // If `--yes` was passed or the caller provided every required
  // override, build answers without ever invoking the prompt.
  const allOverrides = Boolean(
    cli.projectName &&
      cli.targetDir &&
      cli.defaultLocale &&
      cli.contentId
  );
  if (cli.yes || allOverrides) {
    return applyDefaults(cli, argv);
  }

  // Otherwise run the interactive prompt. If the env says we're a
  // TTY-less pipe, abort with a friendly hint instead of hanging.
  if (!process.stdin.isTTY) {
    p.log.warn(
      "No TTY detected. Pass --yes (or the relevant flags) to run non-interactively. See --help."
    );
    p.outro("Aborting.");
    throw new Error("non-interactive without flags");
  }
  // Re-export the prompt function lazily to keep this module small.
  const { prompt } = await import("./prompt.js");
  return prompt(argv);
}

export { applyDefaults, parseArgs, parseLocales, buildFields, toCamelCase };
