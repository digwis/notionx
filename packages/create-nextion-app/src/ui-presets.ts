// packages/create-nextion-app/src/ui-presets.ts
//
// Mirrors the component list from `presets.ts` for callers that
// need the raw array (e.g. the README's "What's included" section)
// plus dependency rendering helpers. The scaffolder only ships the
// "site" set, so there is no preset-selection layer here.

const SITE_PRESET_COMPONENTS = [
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
  dialog: { "@radix-ui/react-dialog": "^1.1.2" },
  "dropdown-menu": { "@radix-ui/react-dropdown-menu": "^2.1.2" },
  label: { "@radix-ui/react-label": "^2.1.0" },
  separator: { "@radix-ui/react-separator": "^1.1.0" },
  sheet: { "@radix-ui/react-dialog": "^1.1.2" },
  tabs: { "@radix-ui/react-tabs": "^1.1.1" },
  tooltip: { "@radix-ui/react-tooltip": "^1.1.4" },
};

export function uiComponents(): readonly string[] {
  return SITE_PRESET_COMPONENTS;
}

export function uiDependencies(): Record<string, string> {
  const deps: Record<string, string> = { ...BASE_DEPENDENCIES };
  for (const component of SITE_PRESET_COMPONENTS) {
    Object.assign(deps, COMPONENT_DEPENDENCIES[component]);
  }
  return Object.fromEntries(
    Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function renderDependencyLines(
  deps: Record<string, string>,
  indent = "    ",
): string {
  return Object.entries(deps)
    .map(
      ([name, version]) =>
        `${indent}${JSON.stringify(name)}: ${JSON.stringify(version)},`,
    )
    .join("\n");
}
