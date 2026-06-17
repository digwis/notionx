// packages/create-notionx-app/tests/locale-add/plan.test.ts
import { describe, expect, it } from "vitest";
import { buildLocaleAddPlan } from "../../src/locale-add/plan";
import type { ScaffoldMetadata } from "../../src/metadata";

const baseMetadata: ScaffoldMetadata = {
  projectKind: "notionx",
  projectName: "demo",
  scaffoldVersion: "1.0.0",
  defaultLocale: "en",
  supportedLocales: ["en"],
  notionxSource: "1.0.0",
  enableSiteSettings: true,
  contentSource: { id: "blog", title: "Blog", fields: [] },
  translationSources: {},
};

describe("buildLocaleAddPlan", () => {
  it("returns metadata + i18n + site-config changes by default", async () => {
    const plan = await buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
    });
    const labels = plan.changes.map((change) => change.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "metadata:supportedLocales",
        "file:lib/i18n/config.ts",
        "file:lib/site/config.ts",
      ])
    );
  });

  it("does not include any notion changes when --with-notion is omitted", async () => {
    const plan = await buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
    });
    expect(plan.changes.some((change) => change.kind === "notion")).toBe(false);
  });

  it("includes notion changes for each built-in model when --with-notion is set", async () => {
    const plan = await buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
      withNotion: true,
    });
    const notion = plan.changes.filter((change) => change.kind === "notion");
    expect(notion.map((change) => change.label)).toEqual(
      expect.arrayContaining([
        "notion:blog-translations",
        "notion:page-translations",
        "notion:block-translations",
        "notion:site-settings-translations",
      ])
    );
  });

  it("includes cloudflare-secret changes for the new translation data source ids", async () => {
    const plan = await buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "zh-CN",
      withNotion: true,
      translationSourceIds: {
        "blog-translations": "ds-blog-zh",
      },
    });
    expect(
      plan.changes.some(
        (change) =>
          change.kind === "cloudflare" &&
          change.label === "cloudflare-secret:NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID"
      )
    ).toBe(true);
  });

  it("yields a plan that records the requested locale in supportedLocales metadata", async () => {
    const plan = await buildLocaleAddPlan({
      projectDir: "/tmp/proj",
      metadata: baseMetadata,
      locale: "fr",
    });
    const metadataChange = plan.changes.find(
      (c) => c.label === "metadata:supportedLocales"
    );
    expect(metadataChange).toBeDefined();
  });
});
