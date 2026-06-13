import type { UiPreset } from "./prompt.js";

export const UI_PRESETS = ["minimal", "site", "app"] as const;

const MINIMAL_COMPONENTS = [
  "badge",
  "button",
  "card",
  "input",
  "label",
  "separator",
  "skeleton",
] as const;

const SITE_COMPONENTS = [
  ...MINIMAL_COMPONENTS,
  "accordion",
  "alert",
  "aspect-ratio",
  "dialog",
  "dropdown-menu",
  "sheet",
  "table",
  "tabs",
  "tooltip",
] as const;

const APP_COMPONENTS = [
  ...SITE_COMPONENTS,
  "avatar",
  "checkbox",
  "popover",
  "radio-group",
  "select",
  "sonner",
  "switch",
  "textarea",
] as const;

const BASE_DEPENDENCIES: Record<string, string> = {
  "@radix-ui/react-slot": "^1.2.0",
  "class-variance-authority": "^0.7.1",
  clsx: "^2.1.1",
  "lucide-react": "^0.460.0",
  "next-themes": "^0.4.4",
  "tailwind-merge": "^2.5.5",
  "tailwindcss-animate": "^1.0.7",
};

const COMPONENT_DEPENDENCIES: Record<string, Record<string, string>> = {
  accordion: { "@radix-ui/react-accordion": "^1.2.1" },
  "aspect-ratio": { "@radix-ui/react-aspect-ratio": "^1.1.0" },
  avatar: { "@radix-ui/react-avatar": "^1.1.1" },
  checkbox: { "@radix-ui/react-checkbox": "^1.1.2" },
  dialog: { "@radix-ui/react-dialog": "^1.1.2" },
  "dropdown-menu": { "@radix-ui/react-dropdown-menu": "^2.1.2" },
  label: { "@radix-ui/react-label": "^2.1.0" },
  popover: { "@radix-ui/react-popover": "^1.1.2" },
  "radio-group": { "@radix-ui/react-radio-group": "^1.2.1" },
  select: { "@radix-ui/react-select": "^2.1.2" },
  separator: { "@radix-ui/react-separator": "^1.1.0" },
  sheet: { "@radix-ui/react-dialog": "^1.1.2" },
  sonner: { sonner: "^1.7.1" },
  switch: { "@radix-ui/react-switch": "^1.1.1" },
  tabs: { "@radix-ui/react-tabs": "^1.1.1" },
  tooltip: { "@radix-ui/react-tooltip": "^1.1.4" },
};

export function normalizeUiPreset(value: string | undefined): UiPreset {
  if (value === "minimal" || value === "site" || value === "app") {
    return value;
  }
  throw new Error(
    `Invalid UI preset: ${value ?? ""}. Expected minimal, site, or app.`
  );
}

export function uiComponentsForPreset(preset: UiPreset): readonly string[] {
  if (preset === "minimal") return MINIMAL_COMPONENTS;
  if (preset === "app") return APP_COMPONENTS;
  return SITE_COMPONENTS;
}

export function uiDependenciesForPreset(
  preset: UiPreset
): Record<string, string> {
  const deps: Record<string, string> = { ...BASE_DEPENDENCIES };
  for (const component of uiComponentsForPreset(preset)) {
    Object.assign(deps, COMPONENT_DEPENDENCIES[component]);
  }
  return Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
}

export function renderDependencyLines(
  deps: Record<string, string>,
  indent = "    "
): string {
  return Object.entries(deps)
    .map(([name, version]) => `${indent}${JSON.stringify(name)}: ${JSON.stringify(version)},`)
    .join("\n");
}

