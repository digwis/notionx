import { describe, expect, it } from "vitest";
import {
  buildScaffoldMetadata,
  parseScaffoldMetadata,
} from "../src/metadata";
import { DEFAULT_ANSWERS } from "../src/prompt";

describe("ScaffoldMetadata.translationSources", () => {
  it("round-trips an empty translationSources map", () => {
    const answers = {
      ...DEFAULT_ANSWERS,
      projectName: "demo",
      defaultLocale: "en",
      supportedLocales: ["en"],
      contentSource: {
        id: "blog",
        title: "Blog",
        fields: [],
      },
    };
    const built = buildScaffoldMetadata(answers, "1.0.0");
    const raw = JSON.stringify(built);
    const parsed = parseScaffoldMetadata(raw);
    expect(parsed.translationSources).toEqual({});
  });

  it("preserves translationSources when round-tripping", () => {
    const answers = {
      ...DEFAULT_ANSWERS,
      projectName: "demo",
      defaultLocale: "en",
      supportedLocales: ["en", "zh-CN"],
      contentSource: {
        id: "blog",
        title: "Blog",
        fields: [],
      },
    };
    const built = buildScaffoldMetadata(answers, "1.0.0");
    built.translationSources = {
      blog: { dataSourceId: "ds-1", envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID" },
    };
    const parsed = parseScaffoldMetadata(JSON.stringify(built));
    expect(parsed.translationSources?.blog?.dataSourceId).toBe("ds-1");
  });
});
