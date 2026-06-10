// packages/create-nextion-app/src/prompt.ts
//
// Interactive prompt for `create-nextion-app`. Uses `@clack/prompts` to
// gather project metadata that the render step interpolates into the
// generated templates. The shape returned here is the only contract
// between the prompt and the renderer.

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
   * Dependency specifier used for `@nextion/core` in the
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

/**
 * Run the interactive prompt sequence. Cancels (Ctrl-C) throw so the
 * CLI wrapper can exit with a friendly message. The `argv` parameter
 * lets the caller pre-fill answers from positional args; positional
 * arg `argv[2]` (if any) is used as the target directory.
 */
export async function prompt(argv: string[] = process.argv): Promise<Answers> {
  p.intro("create-nextion-app — scaffold a new vinext project");

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

  const targetDir = asString(
    await p.text({
      message: "Target directory?",
      placeholder: `./${projectName || "my-vinext-app"}`,
      initialValue: targetFromArg || `./${projectName || "my-vinext-app"}`,
      validate: (v) => {
        if (!v || v.trim().length === 0) return "Target directory is required";
        return undefined;
      },
    }),
    `./${projectName}`
  );

  const defaultLocale = asString(
    await p.text({
      message: "Default locale?",
      placeholder: "en",
      initialValue: "en",
      validate: (v) => {
        if (!v || v.trim().length === 0) return "Default locale is required";
        return undefined;
      },
    }),
    "en"
  );

  const supportedRaw = asString(
    await p.text({
      message: "Supported locales (comma or space separated)?",
      placeholder: "en",
      initialValue: "en",
    }),
    "en"
  );
  const supportedLocales = parseLocales(supportedRaw).length
    ? Array.from(new Set([defaultLocale, ...parseLocales(supportedRaw)]))
    : [defaultLocale];

  const contentId = asString(
    await p.text({
      message: "First content source id?",
      placeholder: "blog",
      initialValue: "blog",
      validate: (v) => {
        if (!v || v.trim().length === 0) return "Source id is required";
        if (!/^[a-z][a-z0-9-]*$/.test(v.trim()))
          return "Use lowercase letters, digits, or dashes";
        return undefined;
      },
    }),
    "blog"
  );

  const contentTitle = asString(
    await p.text({
      message: "First content source title?",
      placeholder: "Blog",
      initialValue: contentId.charAt(0).toUpperCase() + contentId.slice(1),
    }),
    contentId
  );

  const fieldsRaw = asString(
    await p.text({
      message: "Field names (comma separated, in order)?",
      placeholder: "Title, Slug, Description",
      initialValue: "Title, Slug, Description",
    }),
    "Title, Slug, Description"
  );

  const fieldNames = parseLocales(fieldsRaw);
  const fields: AnswersContentField[] = (fieldNames.length ? fieldNames : ["Title"]).map(
    (name) => ({
      key: toCamelCase(name),
      notionName: name,
    })
  );

  // Deduplicate by key (in case user typed the same name twice with
  // different casing) and validate the key shape.
  const seen = new Set<string>();
  const dedupedFields: AnswersContentField[] = [];
  for (const f of fields) {
    if (!FIELD_KEY_RE.test(f.key)) {
      p.log.warn(
        `Skipping field "${f.notionName}" — key "${f.key}" is not a valid identifier`
      );
      continue;
    }
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    dedupedFields.push(f);
  }

  if (dedupedFields.length === 0) {
    dedupedFields.push({ key: "title", notionName: "Title" });
  }

  const confirmed = await p.confirm({
    message: "Generate the project with these settings?",
    initialValue: true,
  });
  if (!confirmed || p.isCancel(confirmed)) {
    p.cancel("Cancelled by user");
    throw new Error("cancelled");
  }

  p.outro("Prompt complete — generating files…");

  return {
    projectName: projectName.trim(),
    targetDir: targetDir.trim(),
    defaultLocale: defaultLocale.trim(),
    supportedLocales,
    nextionSource: "workspace:*",
    contentSource: {
      id: contentId.trim(),
      title: contentTitle.trim() || contentId.trim(),
      fields: dedupedFields,
    },
  };
}
