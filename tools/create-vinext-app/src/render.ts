// tools/create-vinext-app/src/render.ts
//
// File renderer for `create-vinext-app`. Walks the `src/templates/`
// directory, copies static files verbatim, and renders `.tmpl` files
// with simple `{{token}}` interpolation. The token map is derived
// from the prompt answers.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Answers } from "./prompt.js";

interface TokenMap {
  projectName: string;
  projectNameLower: string;
  targetDir: string;
  defaultLocale: string;
  supportedLocales: string;
  supportedLocalesJson: string;
  foundationSource: string;
  contentSourceId: string;
  contentSourceTitle: string;
  contentSourceKind: string;
  contentSourceListPath: string;
  contentSourceDetailPath: string;
  contentSourceApiPath: string;
  contentSourceFields: string;
  contentSourceNavLabel: string;
  contentSourcePluralName: string;
  contentSourceListTitle: string;
  contentSourceListDescription: string;
  contentSourceEmptyState: string;
  contentSourceVarName: string;
  contentSourceConstName: string;
  fieldList: string;
}

function toKebab(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toCamel(input: string): string {
  const parts = toKebab(input).split("-");
  return parts
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

function toPascal(input: string): string {
  const camel = toCamel(input);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function buildTokenMap(answers: Answers): TokenMap {
  const id = answers.contentSource.id;
  // Build the field map block that the generated `defineContentSource`
  // call interpolates. Indent every key/value so the call stays
  // readable inside the `fields: { ... }` object literal.
  const fieldMapLines = answers.contentSource.fields.map((f) => {
    const key = f.key;
    const notionName = JSON.stringify(f.notionName);
    return `      ${key}: ${notionName},`;
  });
  const fieldMapBlock = fieldMapLines.join("\n");
  return {
    projectName: answers.projectName,
    projectNameLower: answers.projectName.toLowerCase(),
    targetDir: answers.targetDir,
    defaultLocale: answers.defaultLocale,
    supportedLocales: answers.supportedLocales.join(", "),
    supportedLocalesJson: JSON.stringify(answers.supportedLocales),
    foundationSource: answers.foundationSource,
    contentSourceId: id,
    contentSourceTitle: answers.contentSource.title,
    contentSourceKind: '"article"',
    contentSourceListPath: `/${id}`,
    contentSourceDetailPath: `/${id}/[slug]`,
    contentSourceApiPath: `/api/${id}`,
    contentSourceFields: fieldMapBlock,
    contentSourceVarName: `${toCamel(id)}Source`,
    contentSourceConstName: `${toCamel(id)}ContentModel`,
    contentSourceNavLabel: answers.contentSource.title,
    contentSourcePluralName: `${answers.contentSource.title}s`,
    contentSourceListTitle: answers.contentSource.title,
    contentSourceListDescription: `${answers.contentSource.title} entries backed by Notion.`,
    contentSourceEmptyState: `No ${answers.contentSource.title.toLowerCase()} entries yet.`,
    fieldList: answers.contentSource.fields.map((f) => f.key).join(", "),
  };
}

function renderTemplate(input: string, tokens: TokenMap): string {
  return input.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (full, key: string) => {
    if (key in tokens) {
      return String((tokens as unknown as Record<string, string>)[key]);
    }
    return full;
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

/**
 * Render the project. `templatesDir` is the absolute path to
 * `src/templates/` inside the scaffolder package; `outDir` is the
 * target directory the user picked in the prompt (relative or
 * absolute). Existing directories are not removed — the caller is
 * responsible for picking a clean target.
 */
export async function render(
  answers: Answers,
  templatesDir: string,
  outDir: string
): Promise<void> {
  const tokens = buildTokenMap(answers);
  const absoluteOut = path.resolve(process.cwd(), outDir);

  if (await exists(absoluteOut)) {
    const entries = await fs.readdir(absoluteOut);
    if (entries.length > 0) {
      throw new Error(
        `Target directory ${absoluteOut} is not empty. Pick an empty path.`
      );
    }
  }

  await ensureDir(absoluteOut);

  // Walk templates/ — every file is either a `.tmpl` (interpolated and
  // written without the `.tmpl` suffix) or a literal copy.
  const entries = await fs.readdir(templatesDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(templatesDir, entry.name);
    if (entry.isDirectory()) {
      const dest = path.join(absoluteOut, entry.name);
      await copyDirWithRender(from, dest, tokens);
    } else if (entry.isFile()) {
      await writeFileWithRender(from, absoluteOut, tokens);
    }
  }
}

async function copyDirWithRender(
  src: string,
  dest: string,
  tokens: TokenMap
): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    if (entry.isDirectory()) {
      await copyDirWithRender(from, path.join(dest, entry.name), tokens);
    } else if (entry.isFile()) {
      await writeFileWithRender(from, dest, tokens);
    }
  }
}

async function writeFileWithRender(
  from: string,
  toDir: string,
  tokens: TokenMap
): Promise<void> {
  const baseName = path.basename(from);
  const isTmpl = baseName.endsWith(".tmpl");
  const outName = isTmpl ? baseName.slice(0, -".tmpl".length) : baseName;
  const outPath = path.join(toDir, outName);

  if (isTmpl) {
    const raw = await fs.readFile(from, "utf8");
    const rendered = renderTemplate(raw, tokens);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, rendered, "utf8");
  } else {
    await ensureDir(path.dirname(outPath));
    await fs.copyFile(from, outPath);
  }
}
