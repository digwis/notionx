// packages/notionx-cli/src/answers.ts
//
// Build an `Answers` object either from the interactive prompt or
// from CLI flags. The CLI flow exists so the scaffolder can run in
// CI / non-TTY smoke tests where `@clack/prompts` would just hang.

import * as p from "@clack/prompts";
import type { Answers, AnswersContentField } from "./prompt.js";
import { generateRandomPassword } from "./password.js";
import { FALLBACK_NOTIONX_SOURCE, resolveNotionxSource } from "./notionx-source.js";

interface CliOverrides {
  starter?: string;
  projectName?: string;
  targetDir?: string;
  defaultLocale?: string;
  supportedLocales?: string;
  contentId?: string;
  contentTitle?: string;
  fields?: string;
  notionxSource?: string;
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
   * When true (the default) the scaffolder creates a separate
   * Notion data source for reusable structured page blocks and the
   * generated `components/page-blocks.tsx` reads from it. Pass
   * `--no-blocks` to opt out.
   */
  enableBlocks?: boolean;
  /**
   * When true (the default) the scaffolder ships the auth module
   * (login/register, D1 users table, sessions). Pass `--no-auth`
   * to opt out.
   */
  enableAuth?: boolean;
  /**
   * When true (the default) the scaffolder ships the admin dashboard.
   * Pass `--no-admin` to opt out. Requires auth.
   */
  enableAdmin?: boolean;
  /**
   * When true (the default) the scaffolder ships the pages module
   * (Notion-backed dynamic pages). Pass `--no-pages` to opt out.
   * Requires blocks.
   */
  enablePages?: boolean;
  /**
   * When true (the default) the scaffolder ships the search module
   * (D1-backed search index, `/api/search` route, search UI). Pass
   * `--no-search` to opt out.
   */
  enableSearch?: boolean;
  yes?: boolean;
}

const DEFAULT_FIELDS = "Name, Slug, Description, Published, Date, Tags, Cover";

/**
 * Resolve a boolean feature flag from CLI overrides or a
 * `CREATE_NOTIONX_NO_*` env var. Defaults to `true` (feature on).
 */
function resolveFlag(
  override: boolean | undefined,
  envVar: string,
): boolean {
  if (override !== undefined) return override;
  const v = process.env[envVar];
  if (v) {
    const lower = v.toLowerCase();
    if (lower === "1" || lower === "true" || lower === "yes") {
      return false;
    }
  }
  return true;
}

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
        case "--starter":
          out.starter = takeNext(next);
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
        case "--notionx-source":
          out.notionxSource = takeNext(next);
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
  console.log(`@notionx/cli — create and maintain Notionx projects

Usage:
  npm create notionx@latest [target-dir] -- [flags]
  create-notionx [target-dir] [flags]

Flags:
  --project-name <name>        Project name (kebab/lower case).
                               Other settings use sensible defaults
                               (locale=en, content source=blog, etc.).
  --target-dir <dir>           Output directory (default: ./<project-name>)
  --default-locale <locale>    Fallback/current language (default: en).
  --supported-locales <list>   Comma/space separated renderable locales.
                               The default locale is always included.
  --notionx-source <spec>      Override the @notionx/core dep value
                               (default: "^3.0.0" — the published
                                npm version). For in-monorepo dev,
                                pass "workspace:*" (requires the
                                target dir to live inside a pnpm
                                workspace that has @notionx/core
                                listed), or "file:../path/to/core".
  --admin-email <addr>         Email granted the admin role (required).
  --admin-password <pwd>       Optional initial password for the admin
                               account (≥8 chars, letters + digits).
                               If omitted, a random one is generated
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
  //   2. Env var                               (CREATE_NOTIONX_ADMIN_EMAIL / _PASSWORD)
  //   3. Sensible placeholder + random password (printed at the end)
  const adminEmail =
    overrides.adminEmail ??
    process.env.CREATE_NOTIONX_ADMIN_EMAIL ??
    "admin@example.com";
  const generatedPassword = generateRandomPassword();
  const adminPassword =
    overrides.adminPassword ??
    process.env.CREATE_NOTIONX_ADMIN_PASSWORD ??
    generatedPassword;
  const generatedAdminPassword =
    adminPassword === generatedPassword ? generatedPassword : undefined;

  // Notion parent page resolution: CLI flag, env var, or skip.
  // The seed count defaults to 3 — the explicit "0" string the user
  // can pass to skip seeding.
  const notionParentPage =
    overrides.notionParentPage ??
    process.env.CREATE_NOTIONX_NOTION_PARENT_PAGE ??
    "";
  const notionSeedCount =
    overrides.notionSeedCount ??
    (process.env.CREATE_NOTIONX_NOTION_SEED_COUNT !== undefined
      ? Number(process.env.CREATE_NOTIONX_NOTION_SEED_COUNT)
      : 3);

  // `enableSiteSettings` defaults to true. `CREATE_NOTIONX_NO_SITE_SETTINGS`
  // is the env-var mirror of `--no-site-settings`; truthy values
  // (1/true/yes) opt out, anything else falls through to the default.
  let enableSiteSettings: boolean = true;
  if (overrides.enableSiteSettings !== undefined) {
    enableSiteSettings = overrides.enableSiteSettings;
  } else if (process.env.CREATE_NOTIONX_NO_SITE_SETTINGS) {
    const v = process.env.CREATE_NOTIONX_NO_SITE_SETTINGS.toLowerCase();
    if (v === "1" || v === "true" || v === "yes") {
      enableSiteSettings = false;
    }
  }

  // `enableBlocks` mirrors `enableSiteSettings` for the reusable
  // page-blocks feature. Same env-var convention.
  let enableBlocks: boolean = true;
  if (overrides.enableBlocks !== undefined) {
    enableBlocks = overrides.enableBlocks;
  } else if (process.env.CREATE_NOTIONX_NO_BLOCKS) {
    const v = process.env.CREATE_NOTIONX_NO_BLOCKS.toLowerCase();
    if (v === "1" || v === "true" || v === "yes") {
      enableBlocks = false;
    }
  }

  // `enableAuth` / `enableAdmin` / `enablePages` follow the same
  // pattern. Each defaults to true; the `CREATE_NOTIONX_NO_*` env
  // var (or the `--no-*` CLI flag via overrides) opts out.
  const enableAuth = resolveFlag(
    overrides.enableAuth,
    "CREATE_NOTIONX_NO_AUTH",
  );
  let enableAdmin = resolveFlag(
    overrides.enableAdmin,
    "CREATE_NOTIONX_NO_ADMIN",
  );
  let enablePages = resolveFlag(
    overrides.enablePages,
    "CREATE_NOTIONX_NO_PAGES",
  );
  const enableSearch = resolveFlag(
    overrides.enableSearch,
    "CREATE_NOTIONX_NO_SEARCH",
  );

  // Enforce dependency constraints: admin requires auth, pages
  // requires blocks. If a dependency is disabled, the dependent
  // feature is forced off regardless of the user's explicit flag.
  if (!enableAuth && enableAdmin) {
    enableAdmin = false;
  }
  if (!enableBlocks && enablePages) {
    enablePages = false;
  }

  return {
    starter: overrides.starter ?? "blog",
    projectName,
    targetDir,
    defaultLocale,
    supportedLocales: supportedLocales.length
      ? Array.from(new Set([defaultLocale, ...supportedLocales]))
      : [defaultLocale],
    notionxSource: overrides.notionxSource ?? FALLBACK_NOTIONX_SOURCE,
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
    enableBlocks,
    enableAuth,
    enableAdmin,
    enablePages,
    enableSearch,
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

  // Resolve the `notionxSource` semver *before* handing the overrides
  // off to `applyDefaults`. The default reads the live version from
  // the npm registry (so freshly-installed scaffolds always match the
  // latest published package without the user passing
  // `--notionx-source`). When the target lives inside the `notionx`
  // monorepo (e.g. `notionx/apps/<name>`), we short-circuit to
  // `workspace:*` so the generated project links against the local
  // `packages/notionx` checkout via pnpm workspace symlinks — this
  // is the scaffolder author's fast path for iterating on `core`.
  // The network call has a 5s timeout and falls back to a hardcoded
  // caret range if the registry is unreachable — we never want a
  // scaffolder to hang because npm is down.
  const positionalTargetDir =
    argv[2] && !argv[2].startsWith("-") ? argv[2] : undefined;
  const probeTargetDir =
    cli.targetDir ?? positionalTargetDir ?? `./${cli.projectName ?? "notionx-app"}`;
  const notionxSource = await resolveNotionxSource(
    cli.notionxSource,
    probeTargetDir
  );

  // If `--yes` was passed, or the caller supplied at least a project
  // name (everything else has sensible defaults), build answers
  // without ever invoking the prompt.
  if (cli.yes || cli.projectName) {
    return applyDefaults({ ...cli, notionxSource }, argv);
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
  return prompt(argv, { notionxSource });
}

export { applyDefaults, parseArgs, parseLocales, buildFields, toCamelCase };
