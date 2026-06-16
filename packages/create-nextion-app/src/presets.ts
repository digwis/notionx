// packages/create-nextion-app/src/presets.ts
//
// The scaffolder ships a single UI component set (the "site" set):
// the shadcn/ui primitives the Notion block renderer leans on.
// Earlier 0.5.x versions offered `minimal`/`app` alternatives;
// those were collapsed because every shipped scaffold needs the
// page-builder components.
//
// The component filenames must match the source `*.tmpl` files in
// `templates/components/ui/` exactly. The renderer does not
// validate this — a typo here silently produces a project missing
// one component file. Tests under `presets.test.ts` pin the file
// set so the gap shows up in CI instead of in a user's project.

/** A dependency line injected into the generated `package.json`. */
export interface PresetDependency {
  /** npm package name, e.g. `"@radix-ui/react-accordion"`. */
  name: string;
  /** Version range, e.g. `"^1.2.1"`. */
  version: string;
}

/**
 * shadcn/ui components vendored into every generated project's
 * `components/ui/` directory.
 */
export const SITE_COMPONENTS: readonly string[] = [
  "accordion",
  "alert",
  "aspect-ratio",
  "badge",
  "button",
  "card",
  "dialog",
  "dropdown-menu",
  "input",
  "label",
  "separator",
  "sheet",
  "skeleton",
  "table",
  "tabs",
  "tooltip",
];

/**
 * Extra `@radix-ui/*` packages required to compile the vendored
 * components above. The base template already declares
 * `@radix-ui/react-slot`, `class-variance-authority`, `clsx`,
 * `lucide-react`, `next-themes`, `tailwind-merge`, and
 * `tailwindcss-animate` — those are not duplicated here.
 */
export const SITE_DEPENDENCIES: readonly PresetDependency[] = [
  { name: "@radix-ui/react-accordion", version: "^1.2.2" },
  { name: "@radix-ui/react-alert-dialog", version: "^1.1.4" },
  { name: "@radix-ui/react-aspect-ratio", version: "^1.1.1" },
  { name: "@radix-ui/react-dialog", version: "^1.1.4" },
  { name: "@radix-ui/react-dropdown-menu", version: "^2.1.4" },
  { name: "@radix-ui/react-label", version: "^2.1.0" },
  { name: "@radix-ui/react-separator", version: "^1.1.0" },
  { name: "@radix-ui/react-slot", version: "^1.2.0" },
  { name: "@radix-ui/react-tabs", version: "^1.1.2" },
  { name: "@radix-ui/react-tooltip", version: "^1.1.6" },
];

/**
 * Render the dependency list for the site component set as a sorted
 * array. Excludes any package that already appears in the base
 * template's dependency block so we don't end up with duplicate
 * keys after a preset upgrade.
 */
export function siteDependencyEntries(
  excludeNames: ReadonlySet<string> = new Set(),
): PresetDependency[] {
  const seen = new Set<string>();
  const out: PresetDependency[] = [];
  for (const dep of SITE_DEPENDENCIES) {
    if (seen.has(dep.name)) continue;
    if (excludeNames.has(dep.name)) continue;
    seen.add(dep.name);
    out.push(dep);
  }
  return out;
}

/**
 * Stable, sorted list of component file basenames. The renderer
 * uses this to decide which files in
 * `templates/components/ui/` survive the copy step. Stable sort
 * makes the generated project deterministic.
 */
export function siteComponentNames(): string[] {
  return [...SITE_COMPONENTS].sort();
}
