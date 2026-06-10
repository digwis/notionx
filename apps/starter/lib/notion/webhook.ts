// Re-exported from @vinext/foundation/notion. Will be removed in Phase 2.
export * from "@vinext/foundation/notion/webhook";

import {
  parseNotionWebhookPayload as parseNotionWebhookPayloadRaw,
  parseNotionWebhookPayloadWithPageLookup as parseNotionWebhookPayloadWithPageLookupRaw,
  compactNotionId,
  type NotionWebhookParseResult,
  type NotionPageRetriever,
  type NotionWebhookModelRegistration,
} from "@vinext/foundation/notion/webhook";
import {
  blogContentModel,
  contentModels,
  movieContentModel,
  movieTranslationsContentModel,
} from "../content/models.ts";
import type { NotionFieldMap } from "@vinext/foundation/notion/types";

type JsonRecord = Record<string, unknown>;

function blogRouteId(page: JsonRecord) {
  const properties = (page.properties ?? {}) as Record<string, unknown>;
  const slug = (() => {
    const slugField = blogContentModel.source.fields.slug;
    const value = properties[slugField] as Record<string, unknown> | undefined;
    if (value?.type === "rich_text" && Array.isArray(value.rich_text)) {
      return value.rich_text
        .map((part: { plain_text?: string }) => part.plain_text ?? "")
        .join("")
        .toLowerCase();
    }
    return "";
  })();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) ? slug : "";
}

function movieRouteId(page: JsonRecord) {
  const id = (page.id as string | undefined) ?? "";
  return id ? compactNotionId(id) : "";
}

function movieTranslationLocale(page: JsonRecord) {
  const properties = (page.properties ?? {}) as Record<string, unknown>;
  const localeField = movieTranslationsContentModel.source.fields.locale;
  const value = properties[localeField] as Record<string, unknown> | undefined;
  if (value?.type === "select") {
    const select = value.select as { name?: string } | null | undefined;
    return select?.name ?? "";
  }
  if (value?.type === "status") {
    const status = value.status as { name?: string } | null | undefined;
    return status?.name ?? "";
  }
  return "";
}

const webhookModels: ReadonlyArray<
  NotionWebhookModelRegistration<NotionFieldMap>
> = contentModels.map((model) => {
  if (model.id === "blog") {
    return {
      ...model,
      resolveRouteId: blogRouteId,
    } as NotionWebhookModelRegistration<NotionFieldMap>;
  }
  if (model.id === "movies") {
    return {
      ...model,
      resolveRouteId: movieRouteId,
    } as NotionWebhookModelRegistration<NotionFieldMap>;
  }
  if (model.id === "movie-translations") {
    return {
      ...model,
      resolveLocale: movieTranslationLocale,
    } as NotionWebhookModelRegistration<NotionFieldMap>;
  }
  return model as NotionWebhookModelRegistration<NotionFieldMap>;
});

/**
 * Starter wrapper around the package's parser. Injects the project's
 * content models so events can be routed to the right model.
 */
export function parseNotionWebhookPayload(
  payload: unknown
): NotionWebhookParseResult {
  return parseNotionWebhookPayloadRaw(payload, { models: webhookModels });
}

export async function parseNotionWebhookPayloadWithPageLookup(
  payload: unknown,
  options?: { retrievePage?: NotionPageRetriever; lookupPages?: boolean }
): Promise<NotionWebhookParseResult> {
  return parseNotionWebhookPayloadWithPageLookupRaw(payload, {
    models: webhookModels,
    ...options,
  });
}

// Re-export models for callers that need them
export { blogContentModel, movieContentModel, movieTranslationsContentModel };
