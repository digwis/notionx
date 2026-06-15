// packages/create-nextion-app/src/locale-add/plan.ts
//
// Pure planning step for `nextion locale add`. Given the project
// context, a locale, and CLI flags, return the list of changes the
// runner should apply. The planner is pure: it never touches disk,
// never shells out, and never throws on missing optional inputs.
//
// The output is consumed by the runner (see `apply.ts`) which is
// the only thing that mutates state. This makes the planner
// trivially testable and lets the CLI render a dry-run summary
// without side effects.

import type { ScaffoldMetadata } from "../metadata.js";

export type LocaleAddChange =
  | {
      kind: "metadata";
      label: `metadata:${string}`;
      description: string;
      risk: "safe" | "conflict";
      apply: () => Promise<void>;
    }
  | {
      kind: "file";
      label: `file:${string}`;
      description: string;
      risk: "safe" | "conflict";
      filePath: string;
      apply: () => Promise<void>;
    }
  | {
      kind: "notion";
      label: `notion:${string}`;
      description: string;
      risk: "safe" | "conflict";
      modelId: string;
      apply: () => Promise<{ dataSourceId: string } | null>;
    }
  | {
      kind: "cloudflare";
      label: `cloudflare-secret:${string}`;
      description: string;
      risk: "safe" | "conflict";
      envVar: string;
      apply: () => Promise<void>;
    };

export type LocaleAddPlan = {
  locale: string;
  changes: LocaleAddChange[];
};

export type BuildLocaleAddPlanInput = {
  projectDir: string;
  metadata: ScaffoldMetadata;
  locale: string;
  withNotion?: boolean;
  copyFrom?: string;
  /** Pre-resolved translation data source ids, keyed by translation source name. */
  translationSourceIds?: Record<string, string>;
};

const BUILT_IN_NOTION_SOURCES = [
  "blog-translations",
  "page-translations",
  "block-translations",
  "site-settings-translations",
] as const;

export function buildLocaleAddPlan(
  input: BuildLocaleAddPlanInput
): LocaleAddPlan {
  const changes: LocaleAddChange[] = [];
  const { projectDir, metadata, locale } = input;
  const i18nPath = "lib/i18n/config.ts";
  const siteConfigPath = "lib/site/config.ts";
  const metadataPath = ".nextion/scaffold.json";

  // 1. metadata: append locale to supportedLocales.
  const nextMetadata: ScaffoldMetadata = {
    ...metadata,
    supportedLocales: [...metadata.supportedLocales, locale],
  };
  changes.push({
    kind: "metadata",
    label: "metadata:supportedLocales",
    description: `Append "${locale}" to .nextion/scaffold.json supportedLocales.`,
    risk: metadata.supportedLocales.includes(locale) ? "conflict" : "safe",
    async apply() {
      const fs = await import("node:fs/promises");
      const full = `${projectDir}/${metadataPath}`;
      await fs.writeFile(
        full,
        JSON.stringify(nextMetadata, null, 2) + "\n",
        "utf8"
      );
    },
  });

  // 2. lib/i18n/config.ts — append the locale to supportedLocalesJson.
  changes.push({
    kind: "file",
    label: `file:${i18nPath}`,
    description: `Add "${locale}" to lib/i18n/config.ts supportedLocales.`,
    risk: "safe",
    filePath: i18nPath,
    async apply() {
      const fs = await import("node:fs/promises");
      const full = `${projectDir}/${i18nPath}`;
      let content: string;
      try {
        content = await fs.readFile(full, "utf8");
      } catch {
        return;
      }
      const updated = content.replace(
        /supportedLocales:\s*\[[^\]]*\]/,
        (match) => match.replace(/\]$/, `, "${locale}"]`)
      );
      await fs.writeFile(full, updated, "utf8");
    },
  });

  // 3. lib/site/config.ts — append the locale to the locales list.
  changes.push({
    kind: "file",
    label: `file:${siteConfigPath}`,
    description: `Add "${locale}" to lib/site/config.ts locales.`,
    risk: "safe",
    filePath: siteConfigPath,
    async apply() {
      const fs = await import("node:fs/promises");
      const full = `${projectDir}/${siteConfigPath}`;
      let content: string;
      try {
        content = await fs.readFile(full, "utf8");
      } catch {
        return;
      }
      const updated = content.replace(
        /locales:\s*\[[^\]]*\]/,
        (match) => match.replace(/\]$/, `, "${locale}"]`)
      );
      await fs.writeFile(full, updated, "utf8");
    },
  });

  // 4. (optional) Notion translation data sources — declared but the
  // actual create/reuse happens in the translation-sources runner.
  if (input.withNotion) {
    for (const sourceName of BUILT_IN_NOTION_SOURCES) {
      changes.push({
        kind: "notion",
        label: `notion:${sourceName}`,
        description: `Ensure Notion data source "${sourceName}" exists (idempotent: create or reuse).`,
        risk: "safe",
        modelId: sourceName,
        async apply() {
          return null;
        },
      });
    }
  }

  // 5. (optional) Cloudflare secrets for the new translation source ids.
  if (input.withNotion && input.translationSourceIds) {
    for (const [sourceName, dataSourceId] of Object.entries(
      input.translationSourceIds
    )) {
      const envVar = sourceNameToEnvVar(sourceName);
      if (!envVar) continue;
      changes.push({
        kind: "cloudflare",
        label: `cloudflare-secret:${envVar}`,
        description: `Set worker secret ${envVar} to ${dataSourceId}.`,
        risk: "safe",
        envVar,
        async apply() {
          const { setWorkerSecret } = await import("../provision/cloudflare.js");
          await setWorkerSecret(envVar, dataSourceId, projectDir, [dataSourceId]);
        },
      });
    }
  }

  return { locale, changes };
}

function sourceNameToEnvVar(
  sourceName: string
): `NOTION_${string}_TRANSLATIONS_DATA_SOURCE_ID` | null {
  const map: Record<string, `NOTION_${string}_TRANSLATIONS_DATA_SOURCE_ID`> = {
    "blog-translations": "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
    "page-translations": "NOTION_PAGES_TRANSLATIONS_DATA_SOURCE_ID",
    "block-translations": "NOTION_BLOCKS_TRANSLATIONS_DATA_SOURCE_ID",
    "site-settings-translations":
      "NOTION_SITE_SETTINGS_TRANSLATIONS_DATA_SOURCE_ID",
  };
  return map[sourceName] ?? null;
}
