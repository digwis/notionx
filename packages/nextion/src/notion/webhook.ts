import type { KeyValueCacheAdapter } from "../platform/runtime";
import { createNotionClient } from "./client";
import { getNotionConfigForModel } from "./config";
import {
  compactNotionId,
  getRichTextProperty,
  getSelectProperty,
  isValidPublicSlug,
} from "./property-mappers";
import type {
  NotionFieldMap,
  NotionGenericContentModel,
  NotionPageLike,
} from "./types";

type JsonRecord = Record<string, unknown>;

type StoredWebhookVerificationToken = {
  token: string;
  updatedAt: string;
};

/**
 * Mirror of `ContentRevalidateRequest` from `../content/revalidate`.
 * Defined locally to avoid a notion→content cross-tier import
 * (forbidden by `import/no-restricted-paths`). The shapes are kept
 * in sync structurally — TypeScript treats them as interchangeable.
 */
type InvalidationKind = "publish" | "update" | "delete";

type ContentRevalidateRequest = {
  modelId: string;
  pageId?: string;
  routeId?: string;
  previousRouteId?: string;
  locale?: string;
  kind?: InvalidationKind;
  includeApi?: boolean;
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

/**
 * Generic shape that callers (i.e. the starter) supply so the webhook can
 * route events to the correct content model. Each entry must expose the
 * Notion data source id that the model is bound to, and a hook to derive a
 * route id and locale from the Notion page payload.
 */
export type NotionWebhookModelRegistration<
  TFields extends NotionFieldMap = NotionFieldMap,
> = NotionGenericContentModel & {
  source: { fields: TFields };
  resolveRouteId?: (page: JsonRecord) => string;
  resolveLocale?: (page: JsonRecord) => string;
};

export type NotionPageRetriever = (
  pageId: string,
  model: NotionGenericContentModel
) => Promise<NotionPageLike | null>;

export type NotionWebhookParseOptions<
  TFields extends NotionFieldMap = NotionFieldMap,
> = {
  models: ReadonlyArray<NotionWebhookModelRegistration<TFields>>;
  /**
   * Optional override for resolving the data source id of a model. Defaults
   * to `process.env[model.source.dataSourceEnv] ?? model.source.defaultDataSourceId`.
   */
  getModelDataSourceId?: (model: NotionWebhookModelRegistration<TFields>) => string | null;
};

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

function defaultRouteIdFromProperties(
  model: NotionGenericContentModel,
  page: JsonRecord
) {
  const properties = isRecord(page.properties) ? page.properties : {};
  const slugField = firstFieldName(model.source.fields.slug);
  const slug = slugField
    ? getRichTextProperty(properties, slugField).toLowerCase()
    : "";
  return isValidPublicSlug(slug) ? slug : "";
}

function defaultLocaleFromProperties(model: NotionGenericContentModel, page: JsonRecord) {
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

function defaultGetModelDataSourceId(
  model: NotionGenericContentModel
): string | null {
  const fromEnv = process.env[model.source.dataSourceEnv];
  if (fromEnv) return fromEnv;
  return model.source.defaultDataSourceId ?? null;
}

function matchModelByDataSourceId<
  TFields extends NotionFieldMap,
>(
  models: ReadonlyArray<NotionWebhookModelRegistration<TFields>>,
  dataSourceId: string,
  getDataSourceId: (model: NotionWebhookModelRegistration<TFields>) => string | null
) {
  if (!dataSourceId) return null;
  const normalized = normalizeId(dataSourceId);
  return (
    models.find((model) => {
      const configured = getDataSourceId(model);
      return configured ? normalizeId(configured) === normalized : false;
    }) ?? null
  );
}

function findModelForEvent<
  TFields extends NotionFieldMap,
>(
  models: ReadonlyArray<NotionWebhookModelRegistration<TFields>>,
  event: JsonRecord,
  page: JsonRecord | undefined,
  getDataSourceId: (model: NotionWebhookModelRegistration<TFields>) => string | null
) {
  const modelId = firstString(
    readString(event, "modelId"),
    readString(event, "model_id"),
    readString(event.data, "modelId"),
    readString(event.data, "model_id")
  );
  if (modelId) {
    return models.find((model) => model.id === modelId) ?? null;
  }

  const dataSourceId = firstString(
    findDataSourceId(event),
    findIdByType(event, "data_source"),
    readString(event, "data_source_id"),
    readString(event.data, "data_source_id"),
    readString(page?.parent, "data_source_id"),
    readString(page?.parent, "database_id")
  );
  return matchModelByDataSourceId(models, dataSourceId, getDataSourceId);
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

export function parseNotionWebhookPayload<
  TFields extends NotionFieldMap = NotionFieldMap,
>(
  payload: unknown,
  options: NotionWebhookParseOptions<TFields>
): NotionWebhookParseResult {
  if (!isRecord(payload)) return { type: "events", events: [] };

  const verificationToken = readString(payload, "verification_token");
  if (verificationToken) {
    return { type: "verification", verificationToken };
  }

  const getDataSourceId = options.getModelDataSourceId ?? defaultGetModelDataSourceId;

  const events = asRecords(payload.events ?? payload.event ?? payload)
    .map((event) =>
      parseEvent(event, options.models, getDataSourceId)
    )
    .filter((event): event is NotionWebhookEvent => Boolean(event));

  return { type: "events", events };
}

function parseEvent<
  TFields extends NotionFieldMap,
>(
  event: JsonRecord,
  models: ReadonlyArray<NotionWebhookModelRegistration<TFields>>,
  getDataSourceId: (model: NotionWebhookModelRegistration<TFields>) => string | null
): NotionWebhookEvent | null {
  const eventType = firstString(readString(event, "type"), readString(event, "event"));
  if (!eventType) return null;
  const page = pageForEvent(event);
  const model = findModelForEvent(
    models,
    event,
    page ?? undefined,
    getDataSourceId
  );
  if (!model) return null;

  const routeId = page
    ? (model.resolveRouteId?.(page) ??
        defaultRouteIdFromProperties(model, page))
    : "";
  const locale = page
    ? (model.resolveLocale?.(page) ?? defaultLocaleFromProperties(model, page))
    : "";
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

async function defaultRetrieveNotionPage(
  pageId: string,
  model: NotionGenericContentModel
) {
  const config = await getNotionConfigForModel(model);
  const client = createNotionClient(config);
  const page = await client.pages.retrieve({ page_id: pageId });
  return page as NotionPageLike;
}

function resolveWebhookEventRoute<
  TFields extends NotionFieldMap,
>(
  event: NotionWebhookEvent,
  models: ReadonlyArray<NotionWebhookModelRegistration<TFields>>,
  retrievePage: NotionPageRetriever
): Promise<NotionWebhookEvent> {
  if (event.routeId || !event.pageId) return Promise.resolve(event);
  if (event.kind === "delete") return Promise.resolve(event);

  const model = models.find((m) => m.id === event.modelId);
  if (!model) return Promise.resolve(event);

  return retrievePage(event.pageId, model)
    .then((page) => {
      if (!page) return event;
      const pageRecord = page as unknown as JsonRecord;
      const routeId =
        model.resolveRouteId?.(pageRecord) ??
        defaultRouteIdFromProperties(model, pageRecord);
      const locale =
        model.resolveLocale?.(pageRecord) ??
        defaultLocaleFromProperties(model, pageRecord);
      if (!routeId) return event;
      return {
        ...event,
        routeId,
        locale: locale || event.locale,
        reason: "page" as const,
      };
    })
    .catch((error) => {
      const err = error as { code?: string; status?: number; message?: string };
      console.warn(
        JSON.stringify({
          tag: "notion_webhook_page_lookup_failed",
          eventId: event.id,
          eventType: event.eventType,
          modelId: event.modelId,
          pageId: event.pageId,
          code: err?.code,
          status: err?.status,
          message: err?.message ?? String(error),
        })
      );
      return event;
    });
}

export async function parseNotionWebhookPayloadWithPageLookup<
  TFields extends NotionFieldMap = NotionFieldMap,
>(
  payload: unknown,
  options: NotionWebhookParseOptions<TFields> & {
    retrievePage?: NotionPageRetriever;
    lookupPages?: boolean;
  }
): Promise<NotionWebhookParseResult> {
  const parsed = parseNotionWebhookPayload(payload, options);
  if (parsed.type === "verification") return parsed;
  if (options?.lookupPages === false) return parsed;

  const retrievePage = options?.retrievePage ?? defaultRetrieveNotionPage;
  return {
    type: "events",
    events: await Promise.all(
      parsed.events.map((event) =>
        resolveWebhookEventRoute(event, options.models, retrievePage)
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
  return prefixed && prefixed[1] ? prefixed[1].trim() : value;
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

// Re-exported for backwards compatibility with the starter.
export { compactNotionId };
