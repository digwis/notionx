import { describe, it, expect, beforeEach } from "vitest";
import {
  clearRegistryForTests,
  defineContentSource,
  getRegisteredSource,
  getRegisteredSources,
} from "../../src/content/models";
import type { ContentSource } from "../../src/content/models";

const sampleFields = {
  title: "Title",
  slug: "Slug",
} as const;

function sampleSource(id: string): ContentSource {
  return defineContentSource({
    id,
    kind: "article",
    visibility: { public: true, admin: false },
    source: {
      type: "notion",
      tokenEnv: "NOTION_TOKEN",
      dataSourceEnv: `NOTION_DS_${id.toUpperCase()}`,
      fields: sampleFields,
      query: { pageSize: 20 },
    },
    routes: {
      listPath: `/${id}`,
      detailPath: `/${id}/[slug]`,
      detailParam: "slug",
    },
    ui: {
      name: id,
      pluralName: id,
      navLabel: id,
      listTitle: id,
      listDescription: "",
      emptyState: "",
    },
    capabilities: {
      richBlocks: false,
      coverImages: false,
      gatedAssets: false,
    },
  });
}

describe("defineContentSource", () => {
  beforeEach(() => {
    clearRegistryForTests();
  });

  it("registers a source and returns the same value", () => {
    const source = sampleSource("blog");
    expect(source.id).toBe("blog");
    expect(getRegisteredSources()).toContain(source);
  });

  it("replaces a source with the same id (idempotent)", () => {
    const first = sampleSource("blog");
    const second = sampleSource("blog");
    const all = getRegisteredSources().filter((s) => s.id === "blog");
    expect(all).toHaveLength(1);
    expect(all[0]).toBe(second);
    expect(all[0]).not.toBe(first);
  });

  it("appends new sources with different ids", () => {
    sampleSource("blog");
    sampleSource("movies");
    expect(getRegisteredSources().map((s) => s.id).sort()).toEqual([
      "blog",
      "movies",
    ]);
  });

  it("looks up a registered source by id", () => {
    const source = sampleSource("blog");
    expect(getRegisteredSource("blog")).toBe(source);
    expect(getRegisteredSource("missing")).toBeUndefined();
  });

  it("clears the registry when clearRegistryForTests is called", () => {
    sampleSource("blog");
    sampleSource("movies");
    expect(getRegisteredSources().length).toBe(2);
    clearRegistryForTests();
    expect(getRegisteredSources()).toEqual([]);
    expect(getRegisteredSource("blog")).toBeUndefined();
  });
});
