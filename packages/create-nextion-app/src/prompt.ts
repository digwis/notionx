// packages/create-nextion-app/src/prompt.ts
//
// Interactive prompt for `create-nextion-app`. The flow is intentionally
// minimal: we only ask for the project name. Everything else (locale,
// content-source shape, etc.) uses sensible defaults that can be edited
// in the generated project after scaffolding.

import * as p from "@clack/prompts";

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
   * generated `package.json`. Default: `"^0.1.1"` (the version
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
   * Plaintext password for the admin account. Hashed via PBKDF2-SHA256
   * (matching `@notionx/core`'s `hashPassword`) at render time and
   * baked into `migrations/0002_admin_seed.sql`. Never persisted in
   * plaintext — it lives only in memory for the duration of one
   * scaffolder run.
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
  /**
   * UI preset selected at scaffold time. Controls which shadcn/ui
   * primitives are vendored into the generated project, which Radix
   * packages are wired into `package.json`, and which block-renderer
   * modules the generated `components/notion/` tree imports.
   *
   * - `minimal` — lean blog set: Button, Card, Input, Label, Badge,
   *   Separator, Skeleton. The smallest scaffold footprint.
   * - `site` — Notion page builder set: everything in `minimal` plus
   *   Accordion, Alert, Table, AspectRatio, Tabs, Tooltip,
   *   DropdownMenu, Sheet, Dialog. Recommended for Notion-driven
   *   public sites and landing pages.
   * - `app` — full app/dashboard set: everything in `site` plus the
   *   form/control primitives (Select, Textarea, Checkbox, Switch,
   *   RadioGroup, Avatar, Sonner, Form, Popover, Command,
   *   NavigationMenu). Heaviest preset.
   */
  uiPreset: UiPreset;
}

/**
 * UI preset identifier. The string values are stable and stored in
 * package metadata / config — never rename without a migration.
 */
export type UiPreset = "minimal" | "site" | "app";

export const UI_PRESETS: ReadonlyArray<{
  id: UiPreset;
  label: string;
  hint: string;
  description: string;
}> = [
  {
    id: "site",
    label: "Site Builder (recommended)",
    hint: "Notion page builder, marketing sites, docs",
    description:
      "Rich set of shadcn primitives for Notion-driven public sites, " +
      "landing pages, and documentation. Recommended default for " +
      "Notion page-building projects.",
  },
  {
    id: "minimal",
    label: "Minimal",
    hint: "lean blog, simple content site, quick demo",
    description:
      "Smallest footprint. Just enough primitives for blog posts and " +
      "simple content. Easy to extend with `pnpm dlx shadcn add …`.",
  },
  {
    id: "app",
    label: "App Dashboard",
    hint: "admin, dashboards, forms, authenticated apps",
    description:
      "Largest preset. Adds form controls, command palette, popover, " +
      "and navigation menu on top of the site set.",
  },
] as const;

export function isUiPreset(value: unknown): value is UiPreset {
  return value === "minimal" || value === "site" || value === "app";
}

const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9]*$/;

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
  nextionSource: "^0.1.1",
  // Admin defaults are placeholders only — `gatherAnswers()` and the
  // interactive prompt both overwrite them. The strings here are
  // chosen so any logic that accidentally reads them sees clearly
  // non-runnable values.
  adminEmail: "admin@example.com",
  adminPassword: "ChangeMe1234",
  notionParentPage: "",
  notionSeedCount: 3,
  // Site-level config lives in a separate Notion data source by
  // default. The generated project reads site name / tagline /
  // description / default locale / social image from there, with
  // `lib/site/config.ts` as a static fallback. Set to `false` to
  // skip the extra data source entirely (e.g. for projects that
  // don't need operators to edit site copy from Notion).
  enableSiteSettings: true,
  // `site` is the recommended default per docs/superpowers/plans/
  // 2026-06-12-notion-page-builder-ui-plan.md. `minimal` is kept as
  // the escape hatch for lean blogs; the existing scaffolder flow
  // (before the preset was introduced) behaved like `minimal`.
  uiPreset: "site",
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
export async function prompt(argv: string[] = process.argv): Promise<Answers> {
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

  // Summarise the canned defaults so the user knows what they're agreeing to.
  const fieldsList = DEFAULT_ANSWERS.contentSource.fields
    .map((f) => f.notionName)
    .join(", ");
  p.log.info(
    [
      `Defaults:`,
      `  target dir      : ${targetDir}`,
      `  default locale  : ${DEFAULT_ANSWERS.defaultLocale}`,
      `  supported locale: ${DEFAULT_ANSWERS.supportedLocales.join(", ")}`,
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

  // UI preset — controls which shadcn primitives get vendored into
  // `components/ui/` and which Radix packages land in
  // `package.json`. The `site` preset is the recommended default for
  // Notion-driven public sites; `minimal` is the lean-blog escape
  // hatch; `app` is the heaviest set (admin / forms / dashboards).
  const uiPresetSelection = await p.select({
    message: "UI preset?",
    initialValue: DEFAULT_ANSWERS.uiPreset,
    options: UI_PRESETS.map((preset) => ({
      value: preset.id,
      label: preset.label,
      hint: preset.hint,
    })),
  });
  if (p.isCancel(uiPresetSelection)) {
    p.cancel("Cancelled by user");
    throw new Error("cancelled");
  }
  const uiPreset: UiPreset = isUiPreset(uiPresetSelection)
    ? uiPresetSelection
    : DEFAULT_ANSWERS.uiPreset;

  // Admin account — collected last so users see what they're agreeing
  // to before we ask for credentials. The password is hashed at
  // render time and never persisted in plaintext.
  p.log.info(
    "Admin account: the email below is granted the `admin` role on first login. " +
      "The password is hashed (PBKDF2-SHA256, 100k iter) and stored in D1; the scaffolder " +
      "does not save it anywhere on disk."
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
  const adminPassword = asString(
    await p.password({
      message: "Admin password? (≥8 chars, letters + digits)",
      validate: (v) => {
        const t = (v ?? "").trim();
        if (t.length < 8) return "Password must be at least 8 characters";
        if (!/[a-zA-Z]/.test(t) || !/\d/.test(t))
          return "Password must contain both letters and digits";
        return undefined;
      },
    }),
    ""
  );

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
    defaultLocale: DEFAULT_ANSWERS.defaultLocale,
    supportedLocales: DEFAULT_ANSWERS.supportedLocales,
    nextionSource: DEFAULT_ANSWERS.nextionSource,
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
    uiPreset,
  };
}
