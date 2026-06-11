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
   * generated `package.json`. Default: `"workspace:*"`. The CLI
   * `--nextion-source` flag overrides this for non-monorepo
   * smoke tests.
   */
  nextionSource: string;
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
export const DEFAULT_ANSWERS: Omit<Answers, "projectName" | "targetDir"> = {
  defaultLocale: "en",
  supportedLocales: ["en"],
  nextionSource: "workspace:*",
  contentSource: {
    id: "blog",
    title: "Blog",
    fields: [
      { key: "title", notionName: "Title" },
      { key: "slug", notionName: "Slug" },
      { key: "description", notionName: "Description" },
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
  };
}
