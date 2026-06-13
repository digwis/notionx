// packages/create-nextion-app/src/presets.ts
//
// UI preset definitions for the `create-nextion-app` scaffolder. A
// preset is a small bundle of three things:
//
//   1. The list of shadcn/ui component files to copy into
//      `components/ui/` of the generated project.
//   2. The list of `@radix-ui/*` packages (with versions) that the
//      generated `package.json` must depend on, so the vendored
//      components compile and run.
//   3. Other auxiliary packages the preset needs (e.g. `sonner` for
//      the toast primitive, `cmdk` for the command palette, `zod`
//      + `react-hook-form` for the `form` primitive).
//
// Since 0.5.4 the scaffolder ships a single preset (`site`) — the
// Notion page-builder set. The CLI no longer asks which preset to
// bundle. Earlier 0.5.x versions offered `minimal` and `app`
// alternatives; those were collapsed because every shipped scaffold
// (blog, page, etc.) needs the page-builder components, and offering
// a thinner set on a public-site scaffolder produced projects that
// couldn't render the generated `components/notion/` tree.
//
// The component filenames must match the source `*.tmpl` files in
// `templates/components/ui/` exactly. The renderer does not
// validate this — a typo here silently produces a project missing
// one component file. Tests under `presets.test.ts` pin the file
// set so the gap shows up in CI instead of in a user's project.

export type UiPreset = "site";

/** A single shadcn/ui component that ships with a preset. */
export interface PresetUiComponent {
  /** Base file name without extension, e.g. `"accordion"`. */
  name: string;
  /**
   * Optional human note. Currently unused at runtime; reserved for
   * future reporting (e.g. a `--list-components` flag).
   */
  note?: string;
}

/** A dependency line injected into the generated `package.json`. */
export interface PresetDependency {
  /** npm package name, e.g. `"@radix-ui/react-accordion"`. */
  name: string;
  /** Version range, e.g. `"^1.2.1"`. */
  version: string;
  /** Whether the package is a `dependencies` or `devDependencies` entry. */
  kind: "dependency" | "devDependency";
}

export interface UiPresetDefinition {
  id: UiPreset;
  /**
   * Stable, user-visible name printed in the README.
   */
  displayName: string;
  /**
   * One-line summary used in CLI help and the generated README.
   */
  summary: string;
  /** shadcn components included in this preset. */
  components: PresetUiComponent[];
  /** Extra packages required to compile the components above. */
  dependencies: PresetDependency[];
}

/**
 * Site preset: Notion page builder set. The shadcn primitives the
 * Notion block renderer leans on for richer blocks — Accordion
 * (toggles), Alert (callouts), Table, AspectRatio (media), Tabs,
 * Tooltip, DropdownMenu, Sheet (mobile nav), Dialog, plus the
 * minimal blog set (Badge, Button, Card, Input, Label, Separator,
 * Skeleton). This is the only preset the scaffolder ships in 0.5.4+
 * because every shipped scaffold (blog, page, etc.) needs it.
 */
export const SITE_PRESET: UiPresetDefinition = {
  id: "site",
  displayName: "Site Builder",
  summary:
    "Notion page builder, marketing sites, docs. Recommended default " +
    "for Notion-driven public sites and landing pages.",
  components: [
    { name: "accordion" },
    { name: "alert" },
    { name: "aspect-ratio" },
    { name: "badge" },
    { name: "button" },
    { name: "card" },
    { name: "dialog" },
    { name: "dropdown-menu" },
    { name: "input" },
    { name: "label" },
    { name: "separator" },
    { name: "sheet" },
    { name: "skeleton" },
    { name: "table" },
    { name: "tabs" },
    { name: "tooltip" },
  ],
  dependencies: [
    { name: "@radix-ui/react-accordion", version: "^1.2.2", kind: "dependency" },
    { name: "@radix-ui/react-alert-dialog", version: "^1.1.4", kind: "dependency" },
    { name: "@radix-ui/react-aspect-ratio", version: "^1.1.1", kind: "dependency" },
    { name: "@radix-ui/react-dialog", version: "^1.1.4", kind: "dependency" },
    { name: "@radix-ui/react-dropdown-menu", version: "^2.1.4", kind: "dependency" },
    { name: "@radix-ui/react-label", version: "^2.1.0", kind: "dependency" },
    { name: "@radix-ui/react-separator", version: "^1.1.0", kind: "dependency" },
    { name: "@radix-ui/react-slot", version: "^1.2.0", kind: "dependency" },
    { name: "@radix-ui/react-tabs", version: "^1.1.2", kind: "dependency" },
    { name: "@radix-ui/react-tooltip", version: "^1.1.6", kind: "dependency" },
  ],
};

export const UI_PRESET_DEFINITIONS: Readonly<Record<UiPreset, UiPresetDefinition>> = {
  site: SITE_PRESET,
};

/** Get the preset definition for a preset id. */
export function getPresetDefinition(id: UiPreset): UiPresetDefinition {
  return UI_PRESET_DEFINITIONS[id];
}

/**
 * Render the set of dependency lines for a preset as a sorted
 * array of `[name, version]` tuples. Used by the renderer to emit
 * the `dependencies: { … }` block in the generated
 * `package.json`. Excludes any package that already appears in
 * the base template's dependency block so we don't end up with
 * duplicate keys after a preset upgrade.
 */
export function presetDependencyEntries(
  id: UiPreset,
  excludeNames: ReadonlySet<string> = new Set()
): PresetDependency[] {
  const def = getPresetDefinition(id);
  // Deduplicate on package name and respect the exclusion list
  // passed in by the caller. With a single preset the dedup pass
  // is mostly defensive — but `SITE_PRESET.dependencies` does list
  // `@radix-ui/react-slot` once and the base dep block in the
  // template also declares it, so the exclude-set is what keeps
  // the generated `package.json` from emitting the same key twice.
  const seen = new Set<string>();
  const out: PresetDependency[] = [];
  for (const dep of def.dependencies) {
    if (seen.has(dep.name)) continue;
    if (excludeNames.has(dep.name)) continue;
    seen.add(dep.name);
    out.push(dep);
  }
  return out;
}

/**
 * Stable, sorted list of component file basenames for a preset.
 * The renderer uses this to decide which files in
 * `templates/components/ui/` survive the copy step. Stable sort
 * makes the generated project deterministic — same preset always
 * produces the same `git diff` after a no-op regeneration.
 */
export function presetComponentNames(id: UiPreset): string[] {
  return [...getPresetDefinition(id).components]
    .map((c) => c.name)
    .sort();
}
