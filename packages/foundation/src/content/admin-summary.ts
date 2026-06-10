// packages/foundation/src/content/admin-summary.ts
//
// Generic admin summary helpers for content sources.

import type {
  ContentModelDefinition,
  NotionFieldMap,
} from "./models";
import { getRegisteredSources } from "./models";

export type ContentModelAdminSummary = {
  id: string;
  name: string;
  kind: ContentModelDefinition["kind"];
  visibility: "public" | "admin" | "public+admin" | "private";
  listPath: string;
  detailPath: string;
  publicApiPath?: string;
  dataSourceEnv: string;
  hasDefaultDataSource: boolean;
  fieldCount: number;
  capabilities: {
    richBlocks: boolean;
    coverImages: boolean;
    gatedAssets: boolean;
  };
};

function visibilityFor(model: ContentModelDefinition<NotionFieldMap>) {
  if (model.visibility.public && model.visibility.admin) return "public+admin";
  if (model.visibility.public) return "public";
  if (model.visibility.admin) return "admin";
  return "private";
}

export function summarizeContentModelForAdmin(
  model: ContentModelDefinition<NotionFieldMap>
): ContentModelAdminSummary {
  return {
    id: model.id,
    name: model.ui.name,
    kind: model.kind,
    visibility: visibilityFor(model),
    listPath: model.routes.listPath,
    detailPath: model.routes.detailPath,
    publicApiPath: model.routes.publicApiPath,
    dataSourceEnv: model.source.dataSourceEnv,
    hasDefaultDataSource: Boolean(model.source.defaultDataSourceId),
    fieldCount: Object.keys(model.source.fields).length,
    capabilities: model.capabilities,
  };
}

export function getContentModelAdminSummaries(
  models: readonly ContentModelDefinition<NotionFieldMap>[] = getRegisteredSources()
) {
  return models.map(summarizeContentModelForAdmin);
}
