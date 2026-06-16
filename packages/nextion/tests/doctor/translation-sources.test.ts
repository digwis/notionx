import { describe, expect, it } from "vitest";
import { buildNotionxDoctorReport } from "../../src/doctor/doctor";

const baseWrangler = {
  d1_databases: [{ binding: "DB" }],
};

const baseModel = {
  id: "blog",
  kind: "article" as const,
  visibility: { public: true, admin: true },
  routes: {
    listPath: "/blog",
    detailPath: "/blog/[slug]",
    detailParam: "slug",
  },
  source: {
    type: "notion" as const,
    tokenEnv: "NOTION_TOKEN" as const,
    dataSourceEnv: "NOTION_DATA_SOURCE_ID",
    translationSourceEnv: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
    translationSources: ["blog-translations"],
    fields: {},
    query: { pageSize: 10 },
  },
  ui: {
    name: "Blog",
    pluralName: "Blogs",
    navLabel: "Blog",
    listTitle: "Blog",
    listDescription: "Blog posts",
    emptyState: "No blog posts yet",
  },
  capabilities: {
    richBlocks: true,
    coverImages: true,
    gatedAssets: false,
  },
};

describe("translation source checks", () => {
  it("flags missing translation sources for each model in supportedLocales", () => {
    const report = buildNotionxDoctorReport({
      env: { NOTION_TOKEN: "secret" },
      wranglerConfig: baseWrangler,
      models: [baseModel],
      supportedLocales: ["en", "zh-CN"],
      translationSources: {},
    });
    const ids = report.checks.map((check) => check.id);
    expect(ids).toContain("locale.translationSources.blog-translations");
    const blogCheck = report.checks.find(
      (check) => check.id === "locale.translationSources.blog-translations"
    );
    expect(blogCheck?.status).toBe("missing");
  });

  it("passes when translation sources are configured for every model", () => {
    const report = buildNotionxDoctorReport({
      env: { NOTION_TOKEN: "secret" },
      wranglerConfig: baseWrangler,
      models: [baseModel],
      supportedLocales: ["en", "zh-CN"],
      translationSources: {
        "blog-translations": { envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID" },
      },
    });
    const blogCheck = report.checks.find(
      (check) => check.id === "locale.translationSources.blog-translations"
    );
    expect(blogCheck?.status).toBe("ok");
  });

  it("does not emit translation-source checks when only one locale is configured", () => {
    const report = buildNotionxDoctorReport({
      env: { NOTION_TOKEN: "secret" },
      wranglerConfig: baseWrangler,
      models: [baseModel],
      supportedLocales: ["en"],
      translationSources: {},
    });
    const ids = report.checks.map((check) => check.id);
    expect(ids.some((id) => id.startsWith("locale.translationSources."))).toBe(
      false
    );
  });

  it("suggests `notionx locale add` in nextSteps when a translation source is missing", () => {
    const report = buildNotionxDoctorReport({
      env: { NOTION_TOKEN: "secret" },
      wranglerConfig: baseWrangler,
      models: [baseModel],
      supportedLocales: ["en", "zh-CN"],
      translationSources: {},
    });
    expect(
      report.nextSteps.some((step) => step.includes("notionx locale add"))
    ).toBe(true);
  });
});
