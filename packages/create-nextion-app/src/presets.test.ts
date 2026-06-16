import { describe, expect, it } from "vitest";

import {
  SITE_COMPONENTS,
  siteComponentNames,
  siteDependencyEntries,
} from "./presets.js";

describe("site components", () => {
  it("includes the page-builder component set", () => {
    const names = siteComponentNames();
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
    expect(siteComponentNames()).toEqual([...siteComponentNames()].sort());
  });

  it("SITE_COMPONENTS matches siteComponentNames()", () => {
    expect([...SITE_COMPONENTS].sort()).toEqual(siteComponentNames());
  });
});

describe("site dependency entries", () => {
  it("deduplicates Radix packages that appear via multiple components", () => {
    const deps = siteDependencyEntries();
    const seen = new Set<string>();
    for (const dep of deps) {
      expect(seen.has(dep.name)).toBe(false);
      seen.add(dep.name);
    }
  });

  it("respects the exclusion list (caller already covered these)", () => {
    const exclude = new Set(["@radix-ui/react-slot"]);
    const deps = siteDependencyEntries(exclude);
    expect(deps.find((d) => d.name === "@radix-ui/react-slot")).toBeUndefined();
    expect(deps.find((d) => d.name === "@radix-ui/react-accordion")).toBeDefined();
  });
});
