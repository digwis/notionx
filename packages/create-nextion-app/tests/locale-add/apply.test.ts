// packages/create-nextion-app/tests/locale-add/apply.test.ts
import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildLocaleAddPlan } from "../../src/locale-add/plan";
import { runLocaleAddPlan } from "../../src/locale-add/apply";

describe("runLocaleAddPlan", () => {
  it("writes the i18n + site config files idempotently", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "locale-add-"));
    try {
      await mkdir(`${dir}/lib/i18n`, { recursive: true });
      await mkdir(`${dir}/lib/site`, { recursive: true });
      await mkdir(`${dir}/.notionx`, { recursive: true });
      const i18n = `import { defineI18nConfig } from "@notionx/core/i18n";
export const i18n = defineI18nConfig({
  defaultLocale: "en",
  supportedLocales: ["en"],
});
`;
      const site = `export const siteConfig = {
  defaultLocale: "en",
  locales: ["en"],
};
`;
      await writeFile(`${dir}/lib/i18n/config.ts`, i18n, "utf8");
      await writeFile(`${dir}/lib/site/config.ts`, site, "utf8");
      await writeFile(
        `${dir}/.notionx/scaffold.json`,
        JSON.stringify(
          {
            projectKind: "notionx",
            projectName: "demo",
            scaffoldVersion: "1.0.0",
            defaultLocale: "en",
            supportedLocales: ["en"],
            notionxSource: "1.0.0",
            enableSiteSettings: true,
            contentSource: { id: "blog", title: "Blog", fields: [] },
            translationSources: {},
          },
          null,
          2
        )
      );

      const plan = buildLocaleAddPlan({
        projectDir: dir,
        metadata: JSON.parse(
          await readFile(`${dir}/.notionx/scaffold.json`, "utf8")
        ),
        locale: "zh-CN",
      });
      const summary = await runLocaleAddPlan(plan);
      expect(summary.applied).toContain("metadata:supportedLocales");
      expect(summary.applied).toContain("file:lib/i18n/config.ts");
      expect(summary.applied).toContain("file:lib/site/config.ts");

      const i18nAfter = await readFile(`${dir}/lib/i18n/config.ts`, "utf8");
      expect(i18nAfter).toContain('"zh-CN"');
      const siteAfter = await readFile(`${dir}/lib/site/config.ts`, "utf8");
      expect(siteAfter).toContain('"zh-CN"');

      // Idempotent re-run: locale is now in the list. The runner
      // must still not break.
      const plan2 = buildLocaleAddPlan({
        projectDir: dir,
        metadata: JSON.parse(
          await readFile(`${dir}/.notionx/scaffold.json`, "utf8")
        ),
        locale: "zh-CN",
      });
      const summary2 = await runLocaleAddPlan(plan2);
      expect(summary2.failed).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
