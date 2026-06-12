// packages/create-nextion-app/src/render.ts
//
// File renderer for `create-nextion-app`. Walks the `src/templates/`
// directory, copies static files verbatim, and renders `.tmpl` files
// with simple `{{token}}` interpolation. The token map is derived
// from the prompt answers.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Answers, UiPreset } from "./prompt.js";
import { hashPasswordForScaffold } from "./provision/password-hash.js";
import { presetComponentNames, presetDependencyEntries } from "./presets.js";

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
  /** Selected UI preset — see `presets.ts` for the source of truth. */
  uiPreset: UiPreset;
  /**
   * Rendered JSON fragment that lands inside the generated
   * `package.json`'s `dependencies` block. Already comma-trailed
   * and indented so it can sit between `{` and `}` without further
   * post-processing.
   */
  dependenciesBlock: string;
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
    dependenciesBlock: buildDependenciesBlock(answers.uiPreset),
  };
}

/**
 * Build the `dependencies` block that goes into the generated
 * `package.json`. The block is a JSON-style object body (4-space
 * indent, no trailing comma) so it can be dropped between `{` and
 * `}` in the template.
 *
 * The base dependency set is the union of every package the
 * rendered components need. It is augmented by the preset's
 * declared extras (e.g. `@radix-ui/react-accordion` for the
 * `site` preset), filtered against the base set so we never emit
 * duplicate keys.
 */
function buildDependenciesBlock(uiPreset: UiPreset): string {
  // The base dependency set — what every preset needs regardless
  // of which components it vendors. Keep this list stable: it is
  // the floor of every generated project.
  const baseDependencies: ReadonlyArray<readonly [string, string]> = [
    ["@notionx/core", "{{nextionSource}}"],
    ["class-variance-authority", "^0.7.1"],
    ["clsx", "^2.1.1"],
    ["lucide-react", "^0.460.0"],
    ["next", "16.2.7"],
    ["next-themes", "^0.4.4"],
    ["react", "^19.2.7"],
    ["react-dom", "^19.2.7"],
    ["tailwind-merge", "^2.5.5"],
    ["tailwindcss-animate", "^1.0.7"],
  ];

  // The base Radix packages — `minimal` preset also needs these
  // (it vendors `label`, `separator`, and `slot` via the existing
  // `button.tsx`). We seed the dependency block with them so the
  // `minimal` preset compiles even if no preset extras fire.
  const baseRadixDependencies: ReadonlyArray<readonly [string, string]> = [
    ["@radix-ui/react-label", "^2.1.0"],
    ["@radix-ui/react-separator", "^1.1.0"],
    ["@radix-ui/react-slot", "^1.2.0"],
  ];

  const presetExtras = presetDependencyEntries(
    uiPreset,
    new Set([
      // Anything in the base blocks is already covered — drop it
      // from the preset's contribution to avoid emitting the same
      // key twice in the JSON object.
      ...baseDependencies.map(([name]) => name),
      ...baseRadixDependencies.map(([name]) => name),
    ])
  );

  // Merge into a single dedup'd map. Preset extras win on conflict
  // (e.g. the `app` preset may pin a newer `react-hook-form` than
  // a future base set), so they go in last.
  const merged = new Map<string, string>();
  for (const [name, version] of baseDependencies) merged.set(name, version);
  for (const [name, version] of baseRadixDependencies) {
    merged.set(name, version);
  }
  for (const dep of presetExtras) merged.set(dep.name, dep.version);

  // Render as a stable, alphabetised JSON object body. We keep
  // the 4-space indent and the no-trailing-comma convention so the
  // output is diff-friendly.
  const lines: string[] = [];
  const keys = [...merged.keys()].sort();
  for (const name of keys) {
    const version = merged.get(name)!;
    // The `{{nextionSource}}` token is already a string, but we
    // want to keep it unquoted in the output so the template
    // interpolator can still replace it. (We only got here because
    // the token wasn't substituted yet — `buildTokenMap` ran
    // before this; the values array here is the *pre-substitution*
    // shape. The template engine substitutes `{{nextionSource}}`
    // post-merge, so a bare token placeholder must survive.)
    const value = version === "{{nextionSource}}" ? `"{{nextionSource}}"` : JSON.stringify(version);
    lines.push(`    "${name}": ${value}`);
  }
  return lines.join(",\n");
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
      // Directory names may also contain tokens (e.g. the blog page
      // lives at `app/{{contentSourceListPath}}/page.tsx.tmpl` so
      // the directory itself must be rendered to `/blog` at scaffold
      // time). Falling through to a literal name would produce an
      // invalid `{{contentSourceListPath}}` folder in the project.
      const renderedName = renderTemplate(entry.name, tokens);
      await copyDirWithRender(from, path.join(dest, renderedName), tokens);
    } else if (entry.isFile()) {
      // Per-preset component filter: the `components/ui/` tree in
      // the templates directory carries the *union* of every preset
      // (so we only have to maintain one copy of each shadcn
      // component). At copy time, drop files that the selected
      // preset didn't opt into. The `presets.ts` config is the
      // single source of truth for what's in scope.
      if (isUiDirectory(src) && !shouldCopyUiComponent(entry.name, tokens.uiPreset)) {
        continue;
      }
      await writeFileWithRender(from, dest, tokens);
    }
  }
}

/**
 * True when `dir` is the `components/ui/` directory of the
 * templates tree. Used to gate the per-preset component filter
 * (see `copyDirWithRender`).
 */
function isUiDirectory(dir: string): boolean {
  const parts = dir.split(path.sep);
  return (
    parts.length >= 2 &&
    parts[parts.length - 1] === "ui" &&
    parts[parts.length - 2] === "components"
  );
}

/**
 * Decide whether a `components/ui/<file>.tsx.tmpl` should be
 * copied for the given preset. The file list is the union across
 * all presets, and the preset's `components` array declares which
 * ones survive.
 *
 * Files that aren't `.tsx.tmpl` shadcn component copies (e.g. a
 * future `index.ts` helper or a barrel) are always copied — only
 * the named shadcn components participate in the filter.
 */
function shouldCopyUiComponent(fileName: string, uiPreset: UiPreset): boolean {
  if (!fileName.endsWith(".tsx.tmpl")) return true;
  const base = fileName.slice(0, -".tsx.tmpl".length);
  const allowed = new Set(presetComponentNames(uiPreset));
  return allowed.has(base);
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
