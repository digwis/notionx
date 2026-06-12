// packages/create-nextion-app/src/presets.ts
//
// Preset definitions for the `create-nextion-app` scaffolder. A preset
// is a small bundle of three things:
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
// The renderer modules in `templates/components/notion/renderers/`
// can also branch on the preset token (`{{uiPreset}}`) to wire
// different `import` paths, but most preset behaviour is expressed
// in the file-copy and dependency lists below.
//
// The component filenames must match the source `*.tmpl` files in
// `templates/components/ui/` exactly. The renderer does not
// validate this — a typo here silently produces a project missing
// one component file. Tests under `presets.test.ts` pin the file
// set so the gap shows up in CI instead of in a user's project.

import type { UiPreset } from "./prompt.js";

/** A single shadcn/ui component that ships with a preset. */
export interface PresetUiComponent {
  /** Base file name without extension, e.g. `"accordion"`. */
  name: string;
  /**
   * Optional human note. Currently unused at runtime; reserved for
   * future `--ui <preset> --list-components` reporting.
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
   * Stable, user-visible name printed in the README. Keep the
   * wording parallel to `prompt.ts`'s `UI_PRESETS` table.
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
 * Minimal preset: the lean blog set that the scaffolder shipped
 * with before presets existed. Kept as the escape hatch for users
 * who want a tiny `components/ui/` directory and don't need
 * anything Notion-page-builder-shaped.
 */
const MINIMAL_PRESET: UiPresetDefinition = {
  id: "minimal",
  displayName: "Minimal",
  summary:
    "Lean blog set. Just enough primitives for blog posts and simple " +
    "content. Easy to extend with `pnpm dlx shadcn add …`.",
  components: [
    { name: "badge" },
    { name: "button" },
    { name: "card" },
    { name: "input" },
    { name: "label" },
    { name: "separator" },
    { name: "skeleton" },
  ],
  dependencies: [
    // The existing minimal scaffold already vendors these — listed
    // here so the dependency-injection pass is the single source of
    // truth. The renderer will not duplicate an entry that's
    // already in the base `package.json.tmpl` dependency block.
    { name: "@radix-ui/react-label", version: "^2.1.0", kind: "dependency" },
    { name: "@radix-ui/react-separator", version: "^1.1.0", kind: "dependency" },
    { name: "@radix-ui/react-slot", version: "^1.2.0", kind: "dependency" },
  ],
};

/**
 * Site preset: Notion page builder set. Adds the components the
 * Notion block renderer leans on for richer blocks — Accordion
 * (toggles), Alert (callouts), Table, AspectRatio (media), Tabs,
 * Tooltip, DropdownMenu, Sheet (mobile nav), Dialog. This is the
 * recommended default for Notion-driven public sites.
 */
const SITE_PRESET: UiPresetDefinition = {
  id: "site",
  displayName: "Site Builder",
  summary:
    "Notion page builder, marketing sites, docs. Recommended default " +
    "for Notion-driven public sites and landing pages.",
  components: [
    ...MINIMAL_PRESET.components,
    { name: "accordion" },
    { name: "alert" },
    { name: "aspect-ratio" },
    { name: "dialog" },
    { name: "dropdown-menu" },
    { name: "sheet" },
    { name: "table" },
    { name: "tabs" },
    { name: "tooltip" },
  ],
  dependencies: [
    ...MINIMAL_PRESET.dependencies,
    { name: "@radix-ui/react-accordion", version: "^1.2.2", kind: "dependency" },
    { name: "@radix-ui/react-alert-dialog", version: "^1.1.4", kind: "dependency" },
    { name: "@radix-ui/react-aspect-ratio", version: "^1.1.1", kind: "dependency" },
    { name: "@radix-ui/react-dialog", version: "^1.1.4", kind: "dependency" },
    { name: "@radix-ui/react-dropdown-menu", version: "^2.1.4", kind: "dependency" },
    { name: "@radix-ui/react-slot", version: "^1.2.0", kind: "dependency" },
    { name: "@radix-ui/react-tabs", version: "^1.1.2", kind: "dependency" },
    { name: "@radix-ui/react-tooltip", version: "^1.1.6", kind: "dependency" },
  ],
};

/**
 * App preset: everything in `site`, plus the form/control primitives
 * needed for dashboards and authenticated app surfaces. Heaviest
 * preset — pick this when the generated project will host an admin
 * UI or a multi-page authenticated app.
 */
const APP_PRESET: UiPresetDefinition = {
  id: "app",
  displayName: "App Dashboard",
  summary:
    "Full app/dashboard set. Adds form controls, command palette, " +
    "popover, and navigation menu on top of the site set.",
  components: [
    ...SITE_PRESET.components,
    { name: "avatar" },
    { name: "checkbox" },
    { name: "command" },
    { name: "form" },
    { name: "navigation-menu" },
    { name: "popover" },
    { name: "radio-group" },
    { name: "select" },
    { name: "sonner" },
    { name: "switch" },
    { name: "textarea" },
  ],
  dependencies: [
    ...SITE_PRESET.dependencies,
    { name: "@radix-ui/react-avatar", version: "^1.1.2", kind: "dependency" },
    { name: "@radix-ui/react-checkbox", version: "^1.1.3", kind: "dependency" },
    { name: "@radix-ui/react-label", version: "^2.1.1", kind: "dependency" },
    { name: "@radix-ui/react-popover", version: "^1.1.4", kind: "dependency" },
    { name: "@radix-ui/react-radio-group", version: "^1.2.2", kind: "dependency" },
    { name: "@radix-ui/react-select", version: "^2.1.4", kind: "dependency" },
    { name: "@radix-ui/react-switch", version: "^1.1.2", kind: "dependency" },
    { name: "cmdk", version: "^1.0.4", kind: "dependency" },
    { name: "react-hook-form", version: "^7.54.0", kind: "dependency" },
    { name: "sonner", version: "^1.7.1", kind: "dependency" },
    { name: "zod", version: "^3.24.1", kind: "dependency" },
  ],
};

export const UI_PRESET_DEFINITIONS: Readonly<Record<UiPreset, UiPresetDefinition>> = {
  minimal: MINIMAL_PRESET,
  site: SITE_PRESET,
  app: APP_PRESET,
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
  // Deduplicate on package name (the `app` preset includes the
  // `site` deps which in turn include the `minimal` ones), and
  // respect the exclusion list passed in by the caller.
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
