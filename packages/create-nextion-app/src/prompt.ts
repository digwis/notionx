// packages/create-nextion-app/src/prompt.ts
//
// Interactive prompt for `create-nextion-app`. The flow is intentionally
// minimal: we ask for the project name, language mode, and admin email.
// Everything else (content-source shape, etc.) uses sensible defaults
// that can be edited in the generated project after scaffolding.

import * as p from "@clack/prompts";
import { generateRandomPassword } from "./password.js";
import { FALLBACK_NEXTION_SOURCE } from "./nextion-source.js";

export interface AnswersContentField {
  /** Field name in camelCase used in the generated TS model, e.g. "title". */
  key: string;
  /** Notion property name, e.g. "Title". */
  notionName: string;
}

export interface AnswersContentSource {
  id: string;
  title: string;
  fields: AnswersContentField[];
}

export interface Answers {
  projectName: string;
  targetDir: string;
  defaultLocale: string;
  supportedLocales: string[];
  contentSource: AnswersContentSource;
  /**
   * Dependency specifier used for `@notionx/core` in the
   * generated `package.json`. Default: `"^0.1.2"` (the version
   * published to npm). When developing inside the vinext monorepo,
   * pass `--nextion-source workspace:*` (or `link:…` / `file:…`)
   * so the scaffold consumes the local checkout instead.
   */
  nextionSource: string;
  /**
   * Email that gets `role = 'admin'` after the worker boots. Stored
   * in `app_settings.admin_email` and used by `isAdminEmail` to grant
   * the admin role on first login.
   */
  adminEmail: string;
  /**
   * Plaintext password for the admin account. The scaffolder generates
   * it by default, hashes it via PBKDF2-SHA256 at render time, and
   * prints the plaintext once at the end. It is never persisted in
   * plaintext.
   */
  adminPassword: string;
  /**
   * Optional Notion parent page id. When set (and a token is
   * resolvable), the scaffolder auto-creates the content database
   * under this page. Empty string means "ask / skip".
   */
  notionParentPage: string;
  /** Number of sample pages to insert into the new database (0 to skip). */
  notionSeedCount: number;
  /**
   * Create a separate Notion data source for site-level settings
   * (name, tagline, description, default locale, social image) and
   * wire `lib/site/settings.ts` to read from it. Set to `false` to
   * keep site config hard-coded in `lib/site/config.ts`.
   */
  enableSiteSettings: boolean;
}

const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9]*$/;
const LANGUAGE_OPTIONS = {
  en: {
    defaultLocale: "en",
    supportedLocales: ["en"],
    label: "English",
  },
  zh: {
    defaultLocale: "zh-CN",
    supportedLocales: ["zh-CN"],
    label: "中文",
  },
  bilingual: {
    defaultLocale: "en",
    supportedLocales: ["en", "zh-CN"],
    label: "English + 中文",
  },
} as const;

function asString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback;
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

/** Defaults applied when the user accepts the canned scaffolding. */
export const DEFAULT_ANSWERS: Omit<
  Answers,
  "projectName" | "targetDir"
> = {
  defaultLocale: "en",
  supportedLocales: ["en"],
  nextionSource: FALLBACK_NEXTION_SOURCE,
  // Admin defaults are placeholders only — `gatherAnswers()` and the
  // interactive prompt both overwrite them. The strings here are
  // chosen so any logic that accidentally reads them sees clearly
  // non-runnable values.
  adminEmail: "admin@example.com",
  adminPassword: "ChangeMe1234",
  notionParentPage: "",
  notionSeedCount: 6,
  // Site-level config lives in a separate Notion data source by
  // default. The generated project reads site name / tagline /
  // description / default locale / social image from there, with
  // `lib/site/config.ts` as a static fallback. Set to `false` to
  // skip the extra data source entirely (e.g. for projects that
  // don't need operators to edit site copy from Notion).
  enableSiteSettings: true,
  contentSource: {
    id: "blog",
    title: "Blog",
    fields: [
      { key: "title", notionName: "Name" },
      { key: "slug", notionName: "Slug" },
      { key: "description", notionName: "Description" },
      { key: "published", notionName: "Published" },
      { key: "date", notionName: "Date" },
      { key: "tags", notionName: "Tags" },
      { key: "cover", notionName: "Cover" },
    ],
  },
};

/**
 * Run the interactive prompt sequence. Cancels (Ctrl-C) throw so the
 * CLI wrapper can exit with a friendly message. The `argv` parameter
 * lets the caller pre-fill answers from positional args; positional
 * arg `argv[2]` (if any) is used as the target directory.
 *
 * The flow is intentionally minimal: project name → confirm-and-go.
 * All other settings use the canned defaults in `DEFAULT_ANSWERS`.
 */
export async function prompt(
  argv: string[] = process.argv,
  resolved: { nextionSource?: string } = {}
): Promise<Answers> {
  p.intro("@notionx/create-nextion-app — scaffold a new vinext project");

  const targetFromArg = argv[2];

  const projectName = asString(
    await p.text({
      message: "Project name?",
      placeholder: "my-vinext-app",
      validate: (v) => {
        if (!v || v.trim().length === 0) return "Project name is required";
        if (!/^[a-z0-9][a-z0-9-_]*$/i.test(v.trim()))
          return "Use letters, digits, dashes, or underscores";
        return undefined;
      },
    }),
    ""
  );

  const targetDir =
    targetFromArg && targetFromArg.trim().length > 0
      ? targetFromArg.trim()
      : `./${projectName}`;

  const languageMode = await p.select({
    message: "Project language?",
    initialValue: "en",
    options: [
      {
        value: "en",
        label: "English",
        hint: "single-language starter",
      },
      {
        value: "zh",
        label: "中文",
        hint: "单语言中文项目",
      },
      {
        value: "bilingual",
        label: "English + 中文",
        hint: "ready for future multilingual content",
      },
    ],
  });
  if (p.isCancel(languageMode)) {
    p.cancel("Cancelled by user");
    throw new Error("cancelled");
  }
  const localeConfig =
    LANGUAGE_OPTIONS[String(languageMode) as keyof typeof LANGUAGE_OPTIONS] ??
    LANGUAGE_OPTIONS.en;

  // Summarise the canned defaults so the user knows what they're agreeing to.
  const fieldsList = DEFAULT_ANSWERS.contentSource.fields
    .map((f) => f.notionName)
    .join(", ");
  p.log.info(
    [
      `Defaults:`,
      `  target dir      : ${targetDir}`,
      `  language        : ${localeConfig.label}`,
      `  default locale  : ${localeConfig.defaultLocale} (fallback/current)`,
      `  supported locales: ${localeConfig.supportedLocales.join(", ")} (available)`,
      `  content source  : ${DEFAULT_ANSWERS.contentSource.id} (${DEFAULT_ANSWERS.contentSource.title})`,
      `  fields          : ${fieldsList}`,
    ].join("\n")
  );

  const confirmed = await p.confirm({
    message: "Generate the project with these settings?",
    initialValue: true,
  });
  if (!confirmed || p.isCancel(confirmed)) {
    p.cancel("Cancelled by user");
    throw new Error("cancelled");
  }

  // Admin account — collected last so users see what they're agreeing
  // to before we ask for credentials. The password is generated here,
  // hashed at render time, and printed once at the end by index.ts.
  p.log.info(
    "Admin account: the email below is granted the `admin` role on first login. " +
      "The scaffolder will generate an initial password, hash it into D1, " +
      "and print it once after setup so you can log in and change it."
  );
  const adminEmail = asString(
    await p.text({
      message: "Admin email?",
      placeholder: "you@example.com",
      validate: (v) => {
        const t = (v ?? "").trim();
        if (!t) return "Admin email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))
          return "Must be a valid email address";
        return undefined;
      },
    }),
    ""
  );
  const adminPassword = generateRandomPassword();

  p.outro("Prompt complete — generating files…");

  // Validate field keys (defensive — DEFAULT_ANSWERS is hand-written so
  // it should always pass, but we re-run the same guard used by the
  // legacy multi-step prompt).
  const seen = new Set<string>();
  const fields: AnswersContentField[] = [];
  for (const f of DEFAULT_ANSWERS.contentSource.fields) {
    if (!FIELD_KEY_RE.test(f.key)) continue;
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    fields.push(f);
  }

  return {
    projectName: projectName.trim(),
    targetDir,
    defaultLocale: localeConfig.defaultLocale,
    supportedLocales: [...localeConfig.supportedLocales],
    // Caller-supplied `nextionSource` (resolved from the npm
    // registry / monorepo probe by `gatherAnswers()`) wins over
    // the canned default. Without this, a successful registry
    // resolution is silently discarded and the generated
    // `package.json` ends up pinned to `DEFAULT_ANSWERS.nextionSource`
    // even when npm already publishes a newer `@notionx/core`.
    nextionSource: resolved.nextionSource ?? DEFAULT_ANSWERS.nextionSource,
    contentSource: {
      id: DEFAULT_ANSWERS.contentSource.id,
      title: DEFAULT_ANSWERS.contentSource.title,
      fields: fields.length ? fields : DEFAULT_ANSWERS.contentSource.fields,
    },
    adminEmail: adminEmail.toLowerCase(),
    adminPassword,
    notionParentPage: DEFAULT_ANSWERS.notionParentPage,
    notionSeedCount: DEFAULT_ANSWERS.notionSeedCount,
    enableSiteSettings: DEFAULT_ANSWERS.enableSiteSettings,
    _generatedAdminPassword: adminPassword,
  } as Answers & { _generatedAdminPassword: string };
}
