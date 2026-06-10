import {
  contentModels,
  getContentModel,
  type ContentModelId,
} from "../content/models.ts";
import type { ContentRevalidateRequest } from "../content/revalidate.ts";
import type { ContentModelDefinition } from "../content/model.ts";
import type { NotionFieldMap } from "../content/model.ts";
import { createNotionClient } from "./client.ts";
import { getNotionConfigForModel } from "./config.ts";
import { compactNotionId } from "./movies.ts";
import {
  getRichTextProperty,
  getSelectProperty,
  isValidPublicSlug,
} from "./mappers.ts";
import type { NotionPageLike } from "./types.ts";
import type { KeyValueCacheAdapter } from "../platform/runtime.ts";

type JsonRecord = Record<string, unknown>;
type StoredWebhookVerificationToken = {
  token: string;
  updatedAt: string;
};

const WEBHOOK_VERIFICATION_TOKEN_CACHE_KEY =
  "notion:webhook:verification-token:v1";

export type NotionWebhookParseResult =
  | { type: "verification"; verificationToken: string }
  | { type: "events"; events: NotionWebhookEvent[] };

export type NotionWebhookEvent = {
  id?: string;
  eventType: string;
  modelId: string;
  pageId?: string;
  dataSourceId?: string;
  routeId?: string;
  locale?: string;
  kind: "publish" | "update" | "delete";
  includeApi: boolean;
  reason: "page" | "data_source";
};

export type NotionPageRetriever = (
  pageId: string,
  model: ContentModelDefinition<NotionFieldMap>
) => Promise<NotionPageLike | null>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(source: unknown, key: string) {
  if (!isRecord(source)) return "";
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function asRecords(value: unknown) {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return [value];
  return [];
}

function nestedRecords(source: JsonRecord, ...keys: string[]) {
  const records: JsonRecord[] = [];
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) records.push(value);
  }
  return records;
}

function firstString(...values: string[]) {
  return values.find(Boolean) ?? "";
}

function normalizeId(value: string) {
  return value.replaceAll("-", "").toLowerCase();
}

function findIdByType(input: JsonRecord, type: string): string {
  const stack = [input];
  const seen = new Set<JsonRecord>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (readString(current, "type") === type) {
      const id = readString(current, "id");
      if (id) return id;
    }

    for (const value of Object.values(current)) {
      if (isRecord(value)) stack.push(value);
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isRecord(item)) stack.push(item);
        }
      }
    }
  }

  return "";
}

function findDataSourceId(input: JsonRecord): string {
  const stack = [input];
  const seen = new Set<JsonRecord>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    const direct = firstString(
      readString(current, "data_source_id"),
      readString(current, "source_id")
    );
    if (direct) return direct;

    const type = readString(current, "type");
    if (type === "data_source") {
      const id = readString(current, "id");
      if (id) return id;
    }

    for (const value of Object.values(current)) {
      if (isRecord(value)) stack.push(value);
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isRecord(item)) stack.push(item);
        }
      }
    }
  }

  return "";
}

function firstFieldName(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function routeIdFromProperties(
  model: ContentModelDefinition<NotionFieldMap>,
  page: JsonRecord
) {
  if (model.id === "movies") {
    const pageId = readString(page, "id");
    return pageId ? compactNotionId(pageId) : "";
  }

  const properties = isRecord(page.properties) ? page.properties : {};
  const slugField = firstFieldName(model.source.fields.slug);
  const slug = slugField
    ? getRichTextProperty(properties, slugField).toLowerCase()
    : "";
  return isValidPublicSlug(slug) ? slug : "";
}

function localeFromProperties(
  model: ContentModelDefinition<NotionFieldMap>,
  page: JsonRecord
) {
  if (model.id !== "movie-translations") return "";

  const properties = isRecord(page.properties) ? page.properties : {};
  const localeField = firstFieldName(model.source.fields.locale);
  return localeField ? getSelectProperty(properties, localeField) : "";
}

function eventKind(eventType: string): "publish" | "update" | "delete" {
  if (eventType.includes(".deleted")) return "delete";
  if (eventType.includes(".created") || eventType.includes(".undeleted")) {
    return "publish";
  }
  return "update";
}

function matchModelByDataSourceId(dataSourceId: string) {
  if (!dataSourceId) return null;
  const normalized = normalizeId(dataSourceId);
  return (
    contentModels.find((model) => {
      const configured =
        process.env[model.source.dataSourceEnv] ?? model.source.defaultDataSourceId;
      return configured ? normalizeId(configured) === normalized : false;
    }) ?? null
  );
}

function modelForEvent(event: JsonRecord, page?: JsonRecord) {
  const modelId = firstString(
    readString(event, "modelId"),
    readString(event, "model_id"),
    readString(event.data, "modelId"),
    readString(event.data, "model_id")
  );
  if (modelId) return getContentModel(modelId as ContentModelId) ?? null;

  const dataSourceId = firstString(
    findDataSourceId(event),
    findIdByType(event, "data_source"),
    readString(event, "data_source_id"),
    readString(event.data, "data_source_id"),
    readString(page?.parent, "data_source_id"),
    readString(page?.parent, "database_id")
  );
  return matchModelByDataSourceId(dataSourceId);
}

function pageIdForEvent(event: JsonRecord, page?: JsonRecord) {
  return firstString(
    readString(page, "id"),
    findIdByType(event, "page"),
    readString(event, "page_id"),
    readString(event.data, "page_id")
  );
}

function pageForEvent(event: JsonRecord) {
  let fallback: JsonRecord | null = null;
  for (const record of [
    ...nestedRecords(isRecord(event.data) ? event.data : {}, "page", "entity"),
    ...nestedRecords(event, "page", "entity"),
    event,
  ]) {
    const type = readString(record, "type");
    if (type === "page" || readString(record, "object") === "page") {
      if (!readString(record, "id")) continue;
      if (isRecord(record.properties) || isRecord(record.parent)) return record;
      fallback ??= record;
    }
  }
  return fallback;
}

function parseEvent(event: JsonRecord): NotionWebhookEvent | null {
  const eventType = firstString(readString(event, "type"), readString(event, "event"));
  if (!eventType) return null;
  const page = pageForEvent(event);
  const model = modelForEvent(event, page ?? undefined);
  if (!model) return null;

  const routeId = page ? routeIdFromProperties(model, page) : "";
  const locale = page ? localeFromProperties(model, page) : "";
  const dataSourceId = firstString(
    findDataSourceId(event),
    findIdByType(event, "data_source"),
    readString(event, "data_source_id"),
    readString(event.data, "data_source_id"),
    readString(page?.parent, "data_source_id"),
    readString(page?.parent, "database_id")
  );
  const dataSourceEvent =
    eventType.startsWith("data_source.") || eventType.startsWith("database.");
  return {
    id: readString(event, "id") || undefined,
    eventType,
    modelId: model.id,
    pageId: pageIdForEvent(event, page ?? undefined) || undefined,
    dataSourceId: dataSourceId || undefined,
    routeId: routeId || undefined,
    locale: locale || undefined,
    kind: eventKind(eventType),
    includeApi: true,
    reason: page && routeId ? "page" : dataSourceEvent ? "data_source" : "page",
  };
}

export function parseNotionWebhookPayload(payload: unknown): NotionWebhookParseResult {
  if (!isRecord(payload)) return { type: "events", events: [] };

  const verificationToken = readString(payload, "verification_token");
  if (verificationToken) {
    return { type: "verification", verificationToken };
  }

  const events = asRecords(payload.events ?? payload.event ?? payload)
    .map(parseEvent)
    .filter((event): event is NotionWebhookEvent => Boolean(event));

  return { type: "events", events };
}

async function defaultRetrieveNotionPage(
  pageId: string,
  model: ContentModelDefinition<NotionFieldMap>
) {
  const config = await getNotionConfigForModel(model);
  const client = createNotionClient(config);
  const page = await client.pages.retrieve({ page_id: pageId });
  return page as NotionPageLike;
}

async function resolveWebhookEventRoute(input: {
  event: NotionWebhookEvent;
  retrievePage: NotionPageRetriever;
}): Promise<NotionWebhookEvent> {
  if (input.event.routeId || !input.event.pageId) return input.event;
  if (input.event.kind === "delete") return input.event;

  const model = getContentModel(input.event.modelId as ContentModelId);
  if (!model) return input.event;

  try {
    const page = await input.retrievePage(input.event.pageId, model);
    if (!page) return input.event;

    const routeId = routeIdFromProperties(model, page as unknown as JsonRecord);
    const locale = localeFromProperties(model, page as unknown as JsonRecord);
    if (!routeId) return input.event;
    return {
      ...input.event,
      routeId,
      locale: locale || input.event.locale,
      reason: "page",
    };
  } catch (error) {
    const err = error as { code?: string; status?: number; message?: string };
    console.warn(
      JSON.stringify({
        tag: "notion_webhook_page_lookup_failed",
        eventId: input.event.id,
        eventType: input.event.eventType,
        modelId: input.event.modelId,
        pageId: input.event.pageId,
        code: err?.code,
        status: err?.status,
        message: err?.message ?? String(error),
      })
    );
    return input.event;
  }
}

export async function parseNotionWebhookPayloadWithPageLookup(
  payload: unknown,
  options?: { retrievePage?: NotionPageRetriever; lookupPages?: boolean }
): Promise<NotionWebhookParseResult> {
  const parsed = parseNotionWebhookPayload(payload);
  if (parsed.type === "verification") return parsed;
  if (options?.lookupPages === false) return parsed;

  const retrievePage = options?.retrievePage ?? defaultRetrieveNotionPage;
  return {
    type: "events",
    events: await Promise.all(
      parsed.events.map((event) =>
        resolveWebhookEventRoute({ event, retrievePage })
      )
    ),
  };
}

export function notionWebhookEventToRevalidateRequest(
  event: NotionWebhookEvent
): ContentRevalidateRequest {
  return {
    modelId: event.modelId,
    pageId: event.pageId,
    routeId: event.routeId,
    locale: event.locale,
    kind: event.kind,
    includeApi: event.includeApi,
  };
}

export async function signNotionWebhookBody(body: string, verificationToken: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(verificationToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeNotionSignature(signature: string | null) {
  const value = String(signature ?? "").trim();
  const prefixed = value.match(/^sha256=(.+)$/i);
  return prefixed ? prefixed[1].trim() : value;
}

export async function verifyNotionWebhookSignature(input: {
  body: string;
  signature: string | null;
  verificationToken?: string | null;
}) {
  const token = String(input.verificationToken ?? "").trim();
  const signature = normalizeNotionSignature(input.signature);
  if (!token || !signature) return false;
  const expected = await signNotionWebhookBody(input.body, token);
  if (expected.length !== signature.length) return false;

  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return diff === 0;
}

export async function verifyNotionWebhookSignatureWithTokens(input: {
  body: string;
  signature: string | null;
  verificationTokens: Array<string | null | undefined>;
}) {
  const tokens = Array.from(
    new Set(input.verificationTokens.map((token) => String(token ?? "").trim()))
  ).filter(Boolean);

  for (const token of tokens) {
    if (
      await verifyNotionWebhookSignature({
        body: input.body,
        signature: input.signature,
        verificationToken: token,
      })
    ) {
      return true;
    }
  }

  return false;
}

function readStoredWebhookVerificationToken(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (!isRecord(value)) return null;

  const token = readString(value, "token");
  return token || null;
}

export async function getStoredNotionWebhookVerificationToken(
  cache: KeyValueCacheAdapter | null | undefined
) {
  if (!cache) return null;

  try {
    const value = await cache.get<StoredWebhookVerificationToken | string>(
      WEBHOOK_VERIFICATION_TOKEN_CACHE_KEY,
      { cacheTtl: 60 }
    );
    return readStoredWebhookVerificationToken(value);
  } catch (error) {
    console.warn(
      JSON.stringify({
        tag: "notion_webhook_token_lookup_failed",
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return null;
  }
}

export async function putStoredNotionWebhookVerificationToken(
  cache: KeyValueCacheAdapter | null | undefined,
  token: string
) {
  const normalized = token.trim();
  if (!cache || !normalized) return false;

  await cache.put<StoredWebhookVerificationToken>(
    WEBHOOK_VERIFICATION_TOKEN_CACHE_KEY,
    {
      token: normalized,
      updatedAt: new Date().toISOString(),
    },
    {
      metadata: {
        source: "notion-webhook",
      },
    }
  );
  return true;
}
