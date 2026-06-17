// packages/create-notionx-app/src/notion-translation-sources/plan.ts
//
// Pure planner for the four built-in Notion translation data
// sources. The planner never calls the `ntn` CLI; it returns a
// list of `NotionTranslationSourcePlan` records that the runner
// resolves into actual Notion resources.

import type { TranslationSourceRef } from "../metadata.js";
import {
  buildBlogTranslationProperties,
  buildPageTranslationProperties,
  buildBlockTranslationProperties,
  buildSiteSettingsTranslationProperties,
  type NotionPropertyMap,
} from "../provision/notion.js";

export type NotionTranslationSourcePlan = {
  modelId:
    | "blog-translations"
    | "page-translations"
    | "block-translations"
    | "site-settings-translations";
  envVar: string;
  apiToken: string;
  parentPageId: string;
  copyFrom?: string;
  existingDataSourceId?: string;
  action: "create" | "reuse";
  properties: NotionPropertyMap;
  /**
   * Notion database id of the base (non-translation) data source
   * this translation source's `Source` relation should link to.
   * When absent, the relation is created without an explicit target.
   */
  baseDatabaseId?: string;
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

/**
 * Build the Notion `properties` map for a given translation model.
 *
 * `baseDatabaseId` is forwarded to the per-model property builder so
 * the `Source` relation property can point at the right base
 * database. When omitted, the relation is created without an
 * explicit target database (Notion will leave it un-configured).
 */
function propertiesForModel(
  modelId: NotionTranslationSourcePlan["modelId"],
  baseDatabaseId?: string
): NotionPropertyMap {
  switch (modelId) {
    case "blog-translations":
      return buildBlogTranslationProperties(baseDatabaseId);
    case "page-translations":
      return buildPageTranslationProperties(baseDatabaseId);
    case "block-translations":
      return buildBlockTranslationProperties(baseDatabaseId);
    case "site-settings-translations":
      return buildSiteSettingsTranslationProperties(baseDatabaseId);
  }
}

export type PlanNotionTranslationSourcesInput = {
  locale: string;
  parentPageId: string;
  apiToken: string;
  copyFrom?: string;
  existingTranslationSources: Record<string, TranslationSourceRef | undefined>;
  /**
   * Maps each built-in translation model id to the Notion database
   * id of its base (non-translation) data source. When provided, the
   * `Source` relation property of the created translation database
   * will link to the corresponding base database.
   */
  baseDatabaseIds?: {
    "blog-translations"?: string;
    "page-translations"?: string;
    "block-translations"?: string;
    "site-settings-translations"?: string;
  };
};

export function planNotionTranslationSources(
  input: PlanNotionTranslationSourcesInput
): NotionTranslationSourcePlan[] {
  return ALL_MODEL_IDS.map((modelId) => {
    const envVar = MODEL_ID_TO_ENV[modelId];
    const existing = input.existingTranslationSources[modelId];
    const baseDatabaseId = input.baseDatabaseIds?.[modelId];
    return {
      modelId,
      envVar,
      apiToken: input.apiToken,
      parentPageId: input.parentPageId,
      copyFrom: input.copyFrom,
      existingDataSourceId: existing?.dataSourceId,
      action: existing ? "reuse" : "create",
      properties: propertiesForModel(modelId, baseDatabaseId),
      baseDatabaseId,
    };
  });
}
