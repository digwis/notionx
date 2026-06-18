// packages/notionx-cli/src/notion-translation-sources/apply.ts
//
// Applies the planned translation data source changes via the `ntn`
// CLI. This module owns the only place that shells out to Notion for
// translation sources; everything else flows through the same
// `LocaleAddChange` runner.

import { createDatabaseWithProperties } from "../provision/notion.js";
import type { NotionTranslationSourcePlan } from "./plan.js";

export type ApplyTranslationSourcesResult = {
  resolved: Record<string, { dataSourceId: string; envVar: string }>;
  failures: Array<{ modelId: string; error: string }>;
};

export async function applyNotionTranslationSources(
  plans: NotionTranslationSourcePlan[]
): Promise<ApplyTranslationSourcesResult> {
  const result: ApplyTranslationSourcesResult = { resolved: {}, failures: [] };
  for (const plan of plans) {
    if (plan.action === "reuse" && plan.existingDataSourceId) {
      result.resolved[plan.modelId] = {
        dataSourceId: plan.existingDataSourceId,
        envVar: plan.envVar,
      };
      continue;
    }
    try {
      const created = await createDatabaseWithProperties({
        apiToken: plan.apiToken,
        parentPageId: plan.parentPageId,
        title: titleFor(plan.modelId),
        properties: plan.properties,
      });
      result.resolved[plan.modelId] = {
        dataSourceId: created.dataSourceId,
        envVar: plan.envVar,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failures.push({ modelId: plan.modelId, error: message });
    }
  }
  return result;
}

function titleFor(modelId: string): string {
  const map: Record<string, string> = {
    "blog-translations": "Blog Translations",
    "page-translations": "Page Translations",
    "block-translations": "Block Translations",
    "site-settings-translations": "Site Settings Translations",
  };
  return map[modelId] ?? modelId;
}
