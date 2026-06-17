// packages/create-notionx-app/src/locale-add/plan.ts
//
// Pure planning step for `notionx locale add`. Given the project
// context, a locale, and CLI flags, return the list of changes the
// runner should apply. The planner is pure: it never touches disk,
// never shells out, and never throws on missing optional inputs.
//
// The output is consumed by the runner (see `apply.ts`) which is
// the only thing that mutates state. This makes the planner
// trivially testable and lets the CLI render a dry-run summary
// without side effects.

import type { ScaffoldMetadata } from "../metadata.js";
import { planNotionTranslationSources } from "../notion-translation-sources/plan.js";
import { applyNotionTranslationSources } from "../notion-translation-sources/apply.js";
import {
  readRegistryManifest,
  writeRegistryManifest,
} from "../registry/registry-store.js";
import {
  readProjectMeta,
  rerenderModelsFile,
} from "../registry/project-meta.js";
import { resolveTemplatesDir } from "../render.js";

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
  /** Notion API token. Required when `withNotion` is true. */
  notionApiToken?: string;
  /** Notion parent page id for new translation databases. */
  notionParentPageId?: string;
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

  // 1. metadata: append locale to supportedLocales in registry.json.
  changes.push({
    kind: "metadata",
    label: "metadata:supportedLocales",
    description: `Add "${locale}" to supportedLocales in registry.json.`,
    risk: metadata.supportedLocales.includes(locale) ? "conflict" : "safe",
    async apply() {
      const manifest = await readRegistryManifest(projectDir);
      if (!manifest) return;
      if (!manifest.supportedLocales.includes(locale)) {
        manifest.supportedLocales = [...manifest.supportedLocales, locale];
      }
      await writeRegistryManifest(projectDir, manifest);
    },
  });

  // 2. Re-render middleware.ts so SUPPORTED_LOCALES includes the new
  // locale. The middleware template uses {{supportedLocalesJson}}
  // and {{defaultLocale}} tokens. Runs after the metadata change so
  // the freshly-written registry.json is the source of truth.
  changes.push({
    kind: "file",
    label: `file:middleware.ts`,
    description: `Re-render middleware.ts with updated supportedLocales.`,
    risk: "safe",
    filePath: "middleware.ts",
    async apply() {
      const manifest = await readRegistryManifest(projectDir);
      if (!manifest) return;
      const { readFile, writeFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const templatesDir = await resolveTemplatesDir();
      let template: string;
      try {
        template = await readFile(
          path.join(templatesDir, "middleware.ts.tmpl"),
          "utf8",
        );
      } catch {
        return; // Template not found; skip silently.
      }
      const rendered = template
        .replaceAll("{{defaultLocale}}", manifest.defaultLocale)
        .replaceAll(
          "{{supportedLocalesJson}}",
          JSON.stringify(manifest.supportedLocales),
        );
      await writeFile(
        path.join(projectDir, "middleware.ts"),
        rendered,
        "utf8",
      );
    },
  });

  // 3. Re-render lib/content/models.ts so translation source
  // declarations reflect bilingual mode (null → defineContentSource).
  // `rerenderModelsFile` derives `bilingual` from
  // `supportedLocales.length > 1` when not passed explicitly.
  changes.push({
    kind: "file",
    label: `file:lib/content/models.ts`,
    description: `Re-render models.ts with translation source declarations.`,
    risk: "safe",
    filePath: "lib/content/models.ts",
    async apply() {
      const manifest = await readRegistryManifest(projectDir);
      if (!manifest) return;
      try {
        await rerenderModelsFile({
          projectDir,
          templatesDir: await resolveTemplatesDir(),
          project: await readProjectMeta(projectDir, manifest),
          installed: manifest.installed,
          internalSources: {
            siteSettings: manifest.enableSiteSettings,
            blocks: manifest.enableBlocks,
          },
        });
      } catch {
        // Best-effort: if rerender fails (e.g. template not found),
        // skip silently.
      }
    },
  });

  // 4. lib/i18n/config.ts — append the locale to supportedLocalesJson.
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

  // 5. lib/site/config.ts — append the locale to the locales list.
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

  // 6. (optional) Notion translation data sources. When the Notion
  // api token and parent page id are available, the planner produces
  // real create/reuse plans and the `apply` closure runs them via
  // `applyNotionTranslationSources`. When the Notion context is
  // missing, fall back to no-op changes so the plan still renders a
  // dry-run summary.
  if (input.withNotion) {
    const existingSources = input.metadata.translationSources ?? {};
    const plans =
      input.notionApiToken && input.notionParentPageId
        ? planNotionTranslationSources({
            locale: input.locale,
            parentPageId: input.notionParentPageId,
            apiToken: input.notionApiToken,
            copyFrom: input.copyFrom,
            existingTranslationSources: existingSources,
          })
        : [];

    for (const plan of plans) {
      changes.push({
        kind: "notion",
        label: `notion:${plan.modelId}`,
        description: `Ensure Notion data source "${plan.modelId}" exists (idempotent: create or reuse).`,
        risk: "safe",
        modelId: plan.modelId,
        async apply() {
          const result = await applyNotionTranslationSources([plan]);
          const resolved = result.resolved[plan.modelId];
          if (!resolved) {
            const failure = result.failures.find(
              (f) => f.modelId === plan.modelId
            );
            if (failure) {
              throw new Error(
                `Failed to create translation source ${plan.modelId}: ${failure.error}`
              );
            }
            return null;
          }
          return { dataSourceId: resolved.dataSourceId };
        },
      });
    }

    // When notion context is missing, fall back to no-op changes
    // so the plan still renders a dry-run summary.
    if (plans.length === 0) {
      for (const sourceName of BUILT_IN_NOTION_SOURCES) {
        changes.push({
          kind: "notion",
          label: `notion:${sourceName}`,
          description: `Ensure Notion data source "${sourceName}" exists (skipped: no Notion api token or parent page id).`,
          risk: "safe",
          modelId: sourceName,
          async apply() {
            return null;
          },
        });
      }
    }
  }

  // 7. (optional) Cloudflare secrets for the new translation source ids.
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
