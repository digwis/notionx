// packages/notionx-cli/src/locale-add/list.ts
//
// Read-only helper that turns the scaffold metadata into a printable
// `notionx locale list` view. The view is plain data so it can be
// rendered as a table, a JSON dump, or a Markdown summary.

import type { ScaffoldMetadata, TranslationSourceRef } from "../metadata.js";

const BUILT_IN_MODELS = [
  "blog-translations",
  "page-translations",
  "block-translations",
  "site-settings-translations",
] as const;

export type LocaleListRow = {
  locale: string;
  isDefault: boolean;
  translationSources: Array<{
    modelId: string;
    envVar: string;
    configured: boolean;
  }>;
};

export type LocaleListView = {
  rows: LocaleListRow[];
};

function envVarForModel(modelId: string): string {
  switch (modelId) {
    case "blog-translations":
      return "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID";
    case "page-translations":
      return "NOTION_PAGES_TRANSLATIONS_DATA_SOURCE_ID";
    case "block-translations":
      return "NOTION_BLOCKS_TRANSLATIONS_DATA_SOURCE_ID";
    case "site-settings-translations":
      return "NOTION_SITE_SETTINGS_TRANSLATIONS_DATA_SOURCE_ID";
    default: {
      const upper = modelId.replace(/-/g, "_").toUpperCase();
      return `NOTION_${upper}_DATA_SOURCE_ID`;
    }
  }
}

export function buildLocaleListView(input: {
  metadata: ScaffoldMetadata;
}): LocaleListView {
  const sources: Record<string, TranslationSourceRef | undefined> =
    input.metadata.translationSources ?? {};
  const rows: LocaleListRow[] = input.metadata.supportedLocales.map(
    (locale) => ({
      locale,
      isDefault: locale === input.metadata.defaultLocale,
      translationSources: BUILT_IN_MODELS.map((modelId) => {
        const ref = sources[modelId];
        return {
          modelId,
          envVar: ref?.envVar ?? envVarForModel(modelId),
          configured: Boolean(ref?.dataSourceId),
        };
      }),
    })
  );
  return { rows };
}
