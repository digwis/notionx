// packages/create-nextion-app/src/notion-translation-sources/plan.ts
//
// Pure planner for the four built-in Notion translation data
// sources. The planner never calls the `ntn` CLI; it returns a
// list of `NotionTranslationSourcePlan` records that the runner
// resolves into actual Notion resources.

import type { TranslationSourceRef } from "../metadata.js";

export type NotionTranslationSourcePlan = {
  modelId:
    | "blog-translations"
    | "page-translations"
    | "block-translations"
    | "site-settings-translations";
  envVar: string;
  parentPageId: string;
  copyFrom?: string;
  existingDataSourceId?: string;
  action: "create" | "reuse";
};

const MODEL_ID_TO_ENV: Record<
  NotionTranslationSourcePlan["modelId"],
  string
> = {
  "blog-translations": "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
  "page-translations": "NOTION_PAGES_TRANSLATIONS_DATA_SOURCE_ID",
  "block-translations": "NOTION_BLOCKS_TRANSLATIONS_DATA_SOURCE_ID",
  "site-settings-translations":
    "NOTION_SITE_SETTINGS_TRANSLATIONS_DATA_SOURCE_ID",
};

const ALL_MODEL_IDS: NotionTranslationSourcePlan["modelId"][] = [
  "blog-translations",
  "page-translations",
  "block-translations",
  "site-settings-translations",
];

export type PlanNotionTranslationSourcesInput = {
  locale: string;
  parentPageId: string;
  apiToken: string;
  copyFrom?: string;
  existingTranslationSources: Record<string, TranslationSourceRef | undefined>;
};

export function planNotionTranslationSources(
  input: PlanNotionTranslationSourcesInput
): NotionTranslationSourcePlan[] {
  return ALL_MODEL_IDS.map((modelId) => {
    const envVar = MODEL_ID_TO_ENV[modelId];
    const existing = input.existingTranslationSources[modelId];
    return {
      modelId,
      envVar,
      parentPageId: input.parentPageId,
      copyFrom: input.copyFrom,
      existingDataSourceId: existing?.dataSourceId,
      action: existing ? "reuse" : "create",
    };
  });
}
