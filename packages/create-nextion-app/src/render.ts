// packages/create-nextion-app/src/render.ts
//
// File renderer for `create-nextion-app`. Walks the `src/templates/`
// directory, copies static files verbatim, and renders `.tmpl` files
// with simple `{{token}}` interpolation. The token map is derived
// from the prompt answers.

import { promises as fs } from "node:fs";
import path from "node:path";
import { buildScaffoldMetadata, SCAFFOLD_METADATA_FILE } from "./metadata.js";
import type { Answers } from "./prompt.js";
import { hashPasswordForScaffold } from "./provision/password-hash.js";
import {
  renderDependencyLines,
  uiComponentsForPreset,
  uiDependenciesForPreset,
} from "./ui-presets.js";

interface TokenMap {
  projectName: string;
  projectNameLower: string;
  targetDir: string;
  defaultLocale: string;
  supportedLocales: string;
  supportedLocalesJson: string;
  nextionSource: string;
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
  contentSourceRichBlocks: string;
  contentSourceCoverImages: string;
  contentSourceVarName: string;
  contentSourceConstName: string;
  fieldList: string;
  adminEmail: string;
  adminName: string;
  adminPasswordHash: string;
  uiPreset: string;
  uiDependencies: string;
  uiComponentList: string;
  uiComponents: readonly string[];
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

/** Local-part of an email, used as the default display name. */
function localPart(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

async function buildTokenMap(answers: Answers): Promise<TokenMap> {
  const id = answers.contentSource.id;
  const isBlog = id === "blog";
  // Build the field map block that the generated `defineContentSource`
  // call interpolates. Indent every key/value so the call stays
  // readable inside the `fields: { ... }` object literal.
  const fieldMapLines = answers.contentSource.fields.map((f) => {
    const key = f.key;
    const notionName = JSON.stringify(f.notionName);
    return `      ${key}: ${notionName},`;
  });
  const fieldMapBlock = fieldMapLines.join("\n");

  // Hash the admin password with the same algorithm that
  // `@notionx/core`'s `hashPassword` uses, so the generated
  // `0002_admin_seed.sql` produces a row that `verifyPassword` can
  // check on first login. 100k PBKDF2 iterations takes ~200ms on
  // modern hardware — visible in the spinner, worth the wait.
  const adminPasswordHash = await hashPasswordForScaffold(
    answers.adminPassword
  );
  const uiComponents = uiComponentsForPreset(answers.uiPreset);

  return {
    projectName: answers.projectName,
    projectNameLower: answers.projectName.toLowerCase(),
    targetDir: answers.targetDir,
    defaultLocale: answers.defaultLocale,
    supportedLocales: answers.supportedLocales.join(", "),
    supportedLocalesJson: JSON.stringify(answers.supportedLocales),
    nextionSource: answers.nextionSource,
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
    contentSourceListDescription: isBlog
      ? "Blog posts backed by Notion metadata and page body content."
      : `${answers.contentSource.title} entries backed by Notion.`,
    contentSourceEmptyState: isBlog
      ? "No blog posts published yet."
      : `No ${answers.contentSource.title.toLowerCase()} entries yet.`,
    contentSourceRichBlocks: isBlog ? "true" : "false",
    contentSourceCoverImages: isBlog ? "true" : "false",
    fieldList: answers.contentSource.fields.map((f) => f.key).join(", "),
    adminEmail: answers.adminEmail,
    adminName: localPart(answers.adminEmail),
    adminPasswordHash,
    uiPreset: answers.uiPreset,
    uiDependencies: renderDependencyLines(
      uiDependenciesForPreset(answers.uiPreset)
    ),
    uiComponentList: uiComponents.map((name) => `\`${name}\``).join(", "),
    uiComponents,
  };
}

function renderTemplate(input: string, tokens: TokenMap): string {
  return input.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (full, key: string) => {
    const value = (tokens as unknown as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
    return full;
  });
}

function templateUiComponentName(filePath: string): string | null {
  if (path.basename(path.dirname(filePath)) !== "ui") return null;
  const baseName = path.basename(filePath);
  if (!baseName.endsWith(".tsx.tmpl")) return null;
  return baseName.slice(0, -".tsx.tmpl".length);
}

function shouldSkipTemplate(filePath: string, tokens: TokenMap): boolean {
  const component = templateUiComponentName(filePath);
  return Boolean(component && !tokens.uiComponents.includes(component));
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

async function readPackageVersion(): Promise<string> {
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const raw = await fs.readFile(packageJsonUrl, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}

export async function resolveTemplatesDir(): Promise<string> {
  const compiled = path.resolve(import.meta.dirname, "templates");
  const fromSource = path.resolve(import.meta.dirname, "..", "src", "templates");
  return (await exists(compiled)) ? compiled : fromSource;
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
  const tokens = await buildTokenMap(answers);
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
  const scaffoldVersion = await readPackageVersion();
  const metadata = buildScaffoldMetadata(answers, scaffoldVersion);
  const metadataPath = path.join(absoluteOut, SCAFFOLD_METADATA_FILE);
  await ensureDir(path.dirname(metadataPath));
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  // Walk templates/ — every file is either a `.tmpl` (interpolated and
  // written without the `.tmpl` suffix) or a literal copy.
  const entries = await fs.readdir(templatesDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(templatesDir, entry.name);
    if (entry.isDirectory()) {
      const dest = path.join(absoluteOut, entry.name);
      await copyDirWithRender(from, dest, tokens);
    } else if (entry.isFile()) {
      if (shouldSkipTemplate(from, tokens)) continue;
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
      // Directory names may also contain tokens (e.g. the blog page
      // lives at `app/{{contentSourceListPath}}/page.tsx.tmpl` so
      // the directory itself must be rendered to `/blog` at scaffold
      // time). Falling through to a literal name would produce an
      // invalid `{{contentSourceListPath}}` folder in the project.
      const renderedName = renderTemplate(entry.name, tokens);
      await copyDirWithRender(from, path.join(dest, renderedName), tokens);
    } else if (entry.isFile()) {
      if (shouldSkipTemplate(from, tokens)) continue;
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
