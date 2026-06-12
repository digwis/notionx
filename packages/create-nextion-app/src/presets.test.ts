import { describe, expect, it } from "vitest";

import { UI_PRESETS, isUiPreset } from "./prompt.js";
import {
  UI_PRESET_DEFINITIONS,
  presetComponentNames,
  presetDependencyEntries,
} from "./presets.js";

describe("UI preset identifiers", () => {
  it("recognises the three canonical preset strings", () => {
    expect(isUiPreset("minimal")).toBe(true);
    expect(isUiPreset("site")).toBe(true);
    expect(isUiPreset("app")).toBe(true);
  });

  it("rejects unknown preset strings", () => {
    expect(isUiPreset("")).toBe(false);
    expect(isUiPreset("SIte")).toBe(false);
    expect(isUiPreset("appx")).toBe(false);
    expect(isUiPreset(null)).toBe(false);
    expect(isUiPreset(undefined)).toBe(false);
    expect(isUiPreset(42)).toBe(false);
  });

  it("has matching entries in UI_PRESETS and UI_PRESET_DEFINITIONS", () => {
    const ids = UI_PRESETS.map((p) => p.id).sort();
    const defs = Object.keys(UI_PRESET_DEFINITIONS).sort();
    expect(ids).toEqual(["app", "minimal", "site"]);
    expect(defs).toEqual(["app", "minimal", "site"]);
  });
});

describe("preset component files", () => {
  it("includes the minimal set in `minimal`", () => {
    const names = presetComponentNames("minimal");
    expect(names).toContain("button");
    expect(names).toContain("card");
    expect(names).toContain("input");
    expect(names).toContain("label");
    expect(names).toContain("badge");
    expect(names).toContain("separator");
    expect(names).toContain("skeleton");
  });

  it("extends the minimal set in `site`", () => {
    const site = new Set(presetComponentNames("site"));
    for (const name of presetComponentNames("minimal")) {
      expect(site.has(name)).toBe(true);
    }
    // The plan's "recommended" components.
    expect(site.has("accordion")).toBe(true);
    expect(site.has("alert")).toBe(true);
    expect(site.has("table")).toBe(true);
    expect(site.has("aspect-ratio")).toBe(true);
    expect(site.has("tabs")).toBe(true);
    expect(site.has("tooltip")).toBe(true);
    expect(site.has("dropdown-menu")).toBe(true);
    expect(site.has("sheet")).toBe(true);
    expect(site.has("dialog")).toBe(true);
  });

  it("extends the site set in `app`", () => {
    const app = new Set(presetComponentNames("app"));
    for (const name of presetComponentNames("site")) {
      expect(app.has(name)).toBe(true);
    }
    expect(app.has("select")).toBe(true);
    expect(app.has("textarea")).toBe(true);
    expect(app.has("checkbox")).toBe(true);
    expect(app.has("switch")).toBe(true);
    expect(app.has("radio-group")).toBe(true);
    expect(app.has("avatar")).toBe(true);
    expect(app.has("sonner")).toBe(true);
    expect(app.has("form")).toBe(true);
    expect(app.has("popover")).toBe(true);
    expect(app.has("command")).toBe(true);
    expect(app.has("navigation-menu")).toBe(true);
  });

  it("returns a stable, alphabetised list (no ordering flakiness)", () => {
    expect(presetComponentNames("minimal")).toEqual(
      [...presetComponentNames("minimal")].sort()
    );
    expect(presetComponentNames("site")).toEqual(
      [...presetComponentNames("site")].sort()
    );
    expect(presetComponentNames("app")).toEqual(
      [...presetComponentNames("app")].sort()
    );
  });
});

describe("preset dependency entries", () => {
  it("deduplicates across the inherited minimal + site lists", () => {
    const appDeps = presetDependencyEntries("app");
    const seen = new Set<string>();
    for (const dep of appDeps) {
      expect(seen.has(dep.name)).toBe(false);
      seen.add(dep.name);
    }
  });

  it("respects the exclusion list (caller already covered these)", () => {
    const exclude = new Set(["@radix-ui/react-slot"]);
    const deps = presetDependencyEntries("site", exclude);
    expect(deps.find((d) => d.name === "@radix-ui/react-slot")).toBeUndefined();
    // Site-only deps still flow through.
    expect(deps.find((d) => d.name === "@radix-ui/react-accordion")).toBeDefined();
  });

  it("wires the right Radix packages per preset", () => {
    const minimalNames = new Set(
      presetDependencyEntries("minimal").map((d) => d.name)
    );
    const siteNames = new Set(
      presetDependencyEntries("site").map((d) => d.name)
    );
    const appNames = new Set(
      presetDependencyEntries("app").map((d) => d.name)
    );
    // Accordion is a site-and-up thing, not in minimal.
    expect(minimalNames.has("@radix-ui/react-accordion")).toBe(false);
    expect(siteNames.has("@radix-ui/react-accordion")).toBe(true);
    expect(appNames.has("@radix-ui/react-accordion")).toBe(true);
    // react-hook-form is app-only.
    expect(siteNames.has("react-hook-form")).toBe(false);
    expect(appNames.has("react-hook-form")).toBe(true);
  });
});
