// packages/create-nextion-app/src/answers.ts
//
// Build an `Answers` object either from the interactive prompt or
// from CLI flags. The CLI flow exists so the scaffolder can run in
// CI / non-TTY smoke tests where `@clack/prompts` would just hang.

import * as p from "@clack/prompts";
import * as crypto from "node:crypto";
import type {
  Answers,
  AnswersContentField,
  UiPreset,
} from "./prompt.js";
import { isUiPreset } from "./prompt.js";

interface CliOverrides {
  projectName?: string;
  targetDir?: string;
  defaultLocale?: string;
  supportedLocales?: string;
  contentId?: string;
  contentTitle?: string;
  fields?: string;
  nextionSource?: string;
  adminEmail?: string;
  adminPassword?: string;
  /**
   * Optional Notion parent page id. When supplied (along with a
   * resolvable Notion token — `ntn login` or `NOTION_API_TOKEN`),
   * the scaffolder auto-creates the content database under this
   * page and seeds 3 sample entries. Without it, the Notion step
   * is skipped silently.
   */
  notionParentPage?: string;
  /** Number of sample pages to insert (default 3, 0 to skip). */
  notionSeedCount?: number;
  /**
   * When true (the default) the scaffolder creates a separate
   * Notion data source for site-level config (name, tagline,
   * description, default locale, social image) and the generated
   * `lib/site/settings.ts` reads from it. Pass `--no-site-settings`
   * to opt out.
   */
  enableSiteSettings?: boolean;
  /**
   * UI preset — see `UI_PRESETS` in `prompt.ts` for the canonical
   * list. The string flows straight into the token map (so the
   * generated `package.json` and the per-preset block-renderer
   * imports can branch on it).
   */
  uiPreset?: UiPreset;
  yes?: boolean;
}

const DEFAULT_FIELDS = "Name, Slug, Description, Published, Date, Tags, Cover";

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
  for (const name of names.length ? names : ["Name"]) {
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
    // Accept both `--flag value` and `--flag=value` (the latter is
    // what pnpm/npx pass through when forwarding CLI args). The
    // `i += consumed` pattern at the end of the loop is what keeps
    // us in sync with whichever form the caller used — using `i++`
    // inside each case was wrong because it would also advance past
    // the next flag when the value was supplied inline.
    let arg = argv[i];
    let inlineValue: string | undefined;
    const eq = arg.indexOf("=");
    if (eq > 0) {
      inlineValue = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const next = argv[i + 1];
    let consumed = 0;
    const takeNext = (value: string | undefined) => {
      if (inlineValue !== undefined) {
        // Inline `--flag=value` form. No extra argv to consume.
        return inlineValue;
      }
      if (value === undefined) {
        throw new Error(`Flag ${arg} requires a value`);
      }
      // Space-separated `--flag value` form. We consumed `value`
      // from the next argv position, so the loop's i++ must skip
      // it. Mark that for the loop step at the bottom.
      consumed = 1;
      return value;
    };
    switch (arg) {
        case "--project-name":
          out.projectName = takeNext(next);
          break;
        case "--target-dir":
          out.targetDir = takeNext(next);
          break;
        case "--default-locale":
          out.defaultLocale = takeNext(next);
          break;
        case "--supported-locales":
          out.supportedLocales = takeNext(next);
          break;
        case "--content-id":
          out.contentId = takeNext(next);
          break;
        case "--content-title":
          out.contentTitle = takeNext(next);
          break;
        case "--fields":
          out.fields = takeNext(next);
          break;
        case "--nextion-source":
          out.nextionSource = takeNext(next);
          break;
        case "--admin-email":
          out.adminEmail = takeNext(next);
          break;
        case "--admin-password":
          out.adminPassword = takeNext(next);
          break;
        case "--notion-parent-page":
          out.notionParentPage = takeNext(next);
          break;
        case "--notion-seed-count":
          out.notionSeedCount = Number(takeNext(next));
          break;
        case "--ui": {
          const raw = takeNext(next);
          if (!isUiPreset(raw)) {
            throw new Error(
              `Invalid --ui value "${raw}". Expected one of: minimal, site, app.`
            );
          }
          out.uiPreset = raw;
          break;
        }
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
      i += consumed;
    }
  return out;
}

function printHelp(): void {
  console.log(`@notionx/create-nextion-app — scaffold a new vinext project

Usage:
  @notionx/create-nextion-app [target-dir] [flags]

Flags:
  --project-name <name>        Project name (kebab/lower case).
                               Other settings use sensible defaults
                               (locale=en, content source=blog, etc.).
  --target-dir <dir>           Output directory (default: ./<project-name>)
  --nextion-source <spec>      Override the @notionx/core dep value
                               (default: "^0.1.1" — the published
                                npm version). For in-monorepo dev,
                                pass "workspace:*" (requires the
                                target dir to live inside a pnpm
                                workspace that has @notionx/core
                                listed), or "file:../path/to/core".
  --ui <preset>                UI preset for shadcn primitives and
                               the Notion block renderer. One of:
                                 minimal  - lean blog set
                                 site     - Notion page builder set (default)
                                 app      - admin / dashboard set
                               Drives which files are vendored into
                               components/ui/ and which Radix
                               packages are added to package.json.
  --admin-email <addr>         Email granted the admin role (required).
  --admin-password <pwd>       Password for the admin account (required,
                               ≥8 chars, letters + digits). If omitted
                               in --yes mode, a random one is generated
                               and printed at the end.
  --notion-parent-page <id>    32-char hex page id under which the
                               content database is created. Requires
                               a resolvable Notion token (run
                               "ntn login" first, or set
                               NOTION_API_TOKEN). Skip to leave
                               Notion provisioning for later.
  --notion-seed-count <n>      Number of sample blog pages to seed into the
                               new database (default 3, 0 to skip).
  -y, --yes                    Skip the confirmation prompt
  -h, --help                   Print this help
`);
}

/** Generate a 14-char password with letters + digits, easy to copy. */
function generateRandomPassword(): string {
  // Avoid 0/O/1/l/I for readability; pick from a friendly alphabet.
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const bytes = crypto.randomBytes(14);
  let out = "";
  // Guarantee at least one letter and one digit.
  out += letters[bytes[0] % letters.length];
  out += digits[bytes[1] % digits.length];
  for (let i = 2; i < 14; i++) {
    out += all[bytes[i] % all.length];
  }
  return out;
}

function applyDefaults(overrides: CliOverrides, argv: string[]): Answers {
  const projectName = overrides.projectName ?? "my-vinext-app";
  // Only treat `argv[2]` as a positional `target-dir` argument when
  // it doesn't look like a flag. Without this guard, calls like
  // `cli --project-name=foo` would land `argv[2]` =
  // `"--project-name=foo"` into the target dir, which is a confusing
  // user-visible failure.
  const positionalTargetDir =
    argv[2] && !argv[2].startsWith("-") ? argv[2] : undefined;
  const targetDir =
    overrides.targetDir ?? positionalTargetDir ?? `./${projectName}`;
  const defaultLocale = overrides.defaultLocale ?? "en";
  const supportedLocales = parseLocales(
    overrides.supportedLocales ?? defaultLocale
  );
  const contentId = overrides.contentId ?? "blog";
  const contentTitle =
    overrides.contentTitle ?? contentId.charAt(0).toUpperCase() + contentId.slice(1);
  const fields = buildFields(overrides.fields ?? DEFAULT_FIELDS);

  // Admin email/password resolution for the non-interactive path:
  //   1. CLI flag                              (--admin-email / --admin-password)
  //   2. Env var                               (CREATE_NEXTION_ADMIN_EMAIL / _PASSWORD)
  //   3. Sensible placeholder + random password (printed at the end)
  const adminEmail =
    overrides.adminEmail ??
    process.env.CREATE_NEXTION_ADMIN_EMAIL ??
    "admin@example.com";
  const generatedPassword = generateRandomPassword();
  const adminPassword =
    overrides.adminPassword ??
    process.env.CREATE_NEXTION_ADMIN_PASSWORD ??
    generatedPassword;
  const generatedAdminPassword =
    adminPassword === generatedPassword ? generatedPassword : undefined;

  // Notion parent page resolution: CLI flag, env var, or skip.
  // The seed count defaults to 3 — the explicit "0" string the user
  // can pass to skip seeding.
  const notionParentPage =
    overrides.notionParentPage ??
    process.env.CREATE_NEXTION_NOTION_PARENT_PAGE ??
    "";
  const notionSeedCount =
    overrides.notionSeedCount ??
    (process.env.CREATE_NEXTION_NOTION_SEED_COUNT !== undefined
      ? Number(process.env.CREATE_NEXTION_NOTION_SEED_COUNT)
      : 3);

  // `enableSiteSettings` defaults to true. `CREATE_NEXTION_NO_SITE_SETTINGS`
  // is the env-var mirror of `--no-site-settings`; truthy values
  // (1/true/yes) opt out, anything else falls through to the default.
  let enableSiteSettings: boolean = true;
  if (overrides.enableSiteSettings !== undefined) {
    enableSiteSettings = overrides.enableSiteSettings;
  } else if (process.env.CREATE_NEXTION_NO_SITE_SETTINGS) {
    const v = process.env.CREATE_NEXTION_NO_SITE_SETTINGS.toLowerCase();
    if (v === "1" || v === "true" || v === "yes") {
      enableSiteSettings = false;
    }
  }

  // UI preset: CLI flag, env var, then the recommended `site` default.
  // We validate the env value with `isUiPreset` so a typo (e.g.
  // `CREATE_NEXTION_UI=siite`) fails loud rather than silently
  // downgrading to the default — the user almost certainly meant a
  // preset and a typo would otherwise leave the scaffold
  // inconsistent with the rest of their flags.
  let uiPreset: UiPreset = "site";
  if (overrides.uiPreset) {
    uiPreset = overrides.uiPreset;
  } else if (process.env.CREATE_NEXTION_UI) {
    const envValue = process.env.CREATE_NEXTION_UI;
    if (!isUiPreset(envValue)) {
      throw new Error(
        `Invalid CREATE_NEXTION_UI value "${envValue}". Expected one of: minimal, site, app.`
      );
    }
    uiPreset = envValue;
  }

  return {
    projectName,
    targetDir,
    defaultLocale,
    supportedLocales: supportedLocales.length
      ? Array.from(new Set([defaultLocale, ...supportedLocales]))
      : [defaultLocale],
    nextionSource: overrides.nextionSource ?? "^0.1.1",
    contentSource: {
      id: contentId,
      title: contentTitle,
      fields,
    },
    adminEmail: adminEmail.toLowerCase(),
    adminPassword,
    notionParentPage,
    notionSeedCount,
    enableSiteSettings,
    uiPreset,
    // Carry the random password (if any) so the CLI can echo it to
    // stdout once at the very end of the run. Never persisted to disk
    // and never sent to the database — only the hash lands in D1.
    ...(generatedAdminPassword
      ? { _generatedAdminPassword: generatedAdminPassword }
      : {}),
  } as Answers & { _generatedAdminPassword?: string };
}

/** Internal carrier added by `applyDefaults` for non-interactive runs. */
export interface ExtendedAnswers {
  _generatedAdminPassword?: string;
}

/**
 * Entry point. Resolves answers from CLI flags first; falls back to
 * the interactive prompt when the user did not pass `--yes` and
 * didn't supply the project name on the command line.
 */
export async function gatherAnswers(
  argv: string[] = process.argv
): Promise<Answers & ExtendedAnswers> {
  const cli = parseArgs(argv);

  // If `--yes` was passed, or the caller supplied at least a project
  // name (everything else has sensible defaults), build answers
  // without ever invoking the prompt.
  if (cli.yes || cli.projectName) {
    return applyDefaults(cli, argv);
  }

  // Otherwise run the interactive prompt. If the env says we're a
  // TTY-less pipe, abort with a friendly hint instead of hanging.
  if (!process.stdin.isTTY) {
    p.log.warn(
      "No TTY detected. Pass --project-name <name> (or --yes) to run non-interactively. See --help."
    );
    p.outro("Aborting.");
    throw new Error("non-interactive without flags");
  }
  // Re-export the prompt function lazily to keep this module small.
  const { prompt } = await import("./prompt.js");
  return prompt(argv);
}

export { applyDefaults, parseArgs, parseLocales, buildFields, toCamelCase };
