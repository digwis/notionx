import { describe, expect, it } from "vitest";

import {
  UI_PRESET_DEFINITIONS,
  presetComponentNames,
  presetDependencyEntries,
} from "./presets.js";

describe("site preset", () => {
  it("is the only preset the scaffolder ships", () => {
    expect(Object.keys(UI_PRESET_DEFINITIONS)).toEqual(["site"]);
  });

  it("includes the page-builder component set", () => {
    const names = presetComponentNames("site");
    for (const expected of [
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
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("returns a stable, alphabetised list (no ordering flakiness)", () => {
    expect(presetComponentNames("site")).toEqual(
      [...presetComponentNames("site")].sort()
    );
  });
});

describe("preset dependency entries", () => {
  it("deduplicates Radix packages that appear via multiple components", () => {
    const deps = presetDependencyEntries("site");
    const seen = new Set<string>();
    for (const dep of deps) {
      expect(seen.has(dep.name)).toBe(false);
      seen.add(dep.name);
    }
  });

  it("respects the exclusion list (caller already covered these)", () => {
    const exclude = new Set(["@radix-ui/react-slot"]);
    const deps = presetDependencyEntries("site", exclude);
    expect(deps.find((d) => d.name === "@radix-ui/react-slot")).toBeUndefined();
    expect(deps.find((d) => d.name === "@radix-ui/react-accordion")).toBeDefined();
  });
});
