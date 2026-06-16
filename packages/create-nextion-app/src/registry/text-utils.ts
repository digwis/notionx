// packages/create-nextion-app/src/registry/text-utils.ts
//
// Shared string-casing helpers used by the render layer.
// Previously duplicated in render.ts, render-multi-source.ts, and
// render-content-source-files.ts.

/**
 * Convert an arbitrary id (e.g. `blog`, `my-cool-source`) to
 * `kebab-case` (lowercase, non-alphanumeric runs → `-`).
 */
export function toKebab(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Convert an arbitrary id to `camelCase` (e.g. `blog` → `blog`,
 * `my-cool-source` → `myCoolSource`).
 */
export function toCamel(input: string): string {
  const parts = toKebab(input).split("-").filter(Boolean);
  if (parts.length === 0) return "field";
  const [first, ...rest] = parts;
  return first! + rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/**
 * Convert an arbitrary id to `PascalCase` (e.g. `blog` → `Blog`,
 * `my-cool-source` → `MyCoolSource`).
 */
export function toPascal(input: string): string {
  const camel = toCamel(input);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Uppercase the first character, leave the rest untouched.
 * (e.g. `blog` → `Blog`, `docs` → `Docs`).
 */
export function titleCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}
