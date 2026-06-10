// notion/routes/webhook.ts
//
// POST /api/notion/webhook - Notion webhook receiver
//
// Verifies the Notion signature, parses the event payload, and triggers
// content revalidation for each event. The revalidation itself is
// caller-supplied (`revalidateContentModel`) so the package does not
// reach into the starter's content model registry. The parser is also
// caller-supplied so the starter can inject its content models.
//
// The `RevalidateContentModelFromWebhookFn` type intentionally matches
// the shape consumed by the package's content revalidate route
// factory. Tier restrictions prevent us from importing the worker
// route type directly, so the shape is duplicated here; both the
// `createNotionWebhookRoute` factory and the
// `createContentRevalidateRoute` factory agree on this contract
// because callers wire them together.

import { NextResponse } from "next/server";

import {
  getStoredNotionWebhookVerificationToken,
  notionWebhookEventToRevalidateRequest,
  putStoredNotionWebhookVerificationToken,
  verifyNotionWebhookSignatureWithTokens,
  type NotionWebhookParseResult,
  type NotionPageRetriever,
} from "../webhook";
import { getNotionWebhookVerificationToken } from "../config";
import { getRuntimePlatform } from "../../platform/current";
import type {
  KeyValueCacheAdapter,
  SqlDatabaseAdapter,
} from "../../platform/runtime";

export type NotionWebhookParserFn = (
  payload: unknown,
  options?: { retrievePage?: NotionPageRetriever; lookupPages?: boolean }
) => Promise<NotionWebhookParseResult>;

export type RevalidateContentModelFromWebhookFn = (input: {
  request: {
    modelId: string;
    pageId?: string;
    routeId?: string;
    previousRouteId?: string;
    locale?: string;
    kind?: "publish" | "update" | "delete";
    includeApi?: boolean;
  };
  tokenAuthorized: boolean;
  revalidatePath: (
    path: string,
    type?: "page" | "layout"
  ) => void | Promise<void>;
  contentCache?: KeyValueCacheAdapter;
  getContentCache?: () => KeyValueCacheAdapter | null;
  database?: SqlDatabaseAdapter;
  getDatabase?: () => SqlDatabaseAdapter | null;
}) => Promise<
  | {
      ok: true;
      model: {
        id: string;
        routes: { listPath: string; detailPath: string; publicApiPath?: string };
      };
      routeId?: string;
      revalidatedPaths: string[];
      contentCache: unknown;
      searchIndex: unknown;
    }
  | {
      ok: false;
      status: 400 | 401 | 404;
      error: string;
    }
>;

export type CreateNotionWebhookRouteOptions = {
  revalidatePath: (
    path: string,
    type?: "page" | "layout"
  ) => void | Promise<void>;
  revalidateContentModel: RevalidateContentModelFromWebhookFn;
  /**
   * The starter's parser wrapper that injects its content models.
   * Required; there is no sensible package default because the parser
   * depends on the consumer's content model registrations.
   */
  parseNotionWebhookPayload: NotionWebhookParserFn;
  getVerificationToken?: typeof getNotionWebhookVerificationToken;
};

export function createNotionWebhookRoute(options: CreateNotionWebhookRouteOptions) {
  const parseFn = options.parseNotionWebhookPayload;
  const getToken =
    options.getVerificationToken ?? getNotionWebhookVerificationToken;

  return {
    async POST(request: Request) {
      return handlePost(request, options, parseFn, getToken);
    },
    async handle(request: Request): Promise<Response> {
      if (request.method !== "POST") {
        return NextResponse.json(
          { ok: false, error: "Method not allowed" },
          { status: 405, headers: { "Cache-Control": "no-store" } }
        );
      }
      return handlePost(request, options, parseFn, getToken);
    },
  };
}

async function handlePost(
  request: Request,
  options: CreateNotionWebhookRouteOptions,
  parseFn: NotionWebhookParserFn,
  getToken: typeof getNotionWebhookVerificationToken
) {
  const bodyText = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText || "{}");
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const platform = getRuntimePlatform();
  const parsed = await parseFn(payload, { lookupPages: false });

  if (parsed.type === "verification") {
    const verified = await verifyNotionWebhookSignatureWithTokens({
      body: bodyText,
      signature: request.headers.get("x-notion-signature"),
      verificationTokens: [parsed.verificationToken],
    });
    if (!verified) {
      return NextResponse.json(
        { ok: false, error: "Invalid Notion webhook verification signature" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const stored = await putStoredNotionWebhookVerificationToken(
      platform.keyValueCache,
      parsed.verificationToken
    );
    return NextResponse.json(
      {
        verification_token: parsed.verificationToken,
        stored,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const token = await getToken();
  const storedToken = await getStoredNotionWebhookVerificationToken(
    platform.keyValueCache
  );
  const verified = await verifyNotionWebhookSignatureWithTokens({
    body: bodyText,
    signature: request.headers.get("x-notion-signature"),
    verificationTokens: [token, storedToken],
  });
  if (!verified) {
    return NextResponse.json(
      { ok: false, error: "Invalid Notion webhook signature" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const resolved = await parseFn(payload);
  if (resolved.type === "verification") {
    return NextResponse.json(
      { ok: false, error: "Unexpected verification payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const results = [];
  for (const event of resolved.events) {
    const result = await options.revalidateContentModel({
      request: notionWebhookEventToRevalidateRequest(event),
      tokenAuthorized: true,
      revalidatePath: options.revalidatePath,
      contentCache: platform.keyValueCache ?? undefined,
      getContentCache: () => platform.keyValueCache,
      database: platform.database ?? undefined,
      getDatabase: () => platform.database,
    });
    results.push({
      eventId: event.id,
      eventType: event.eventType,
      modelId: event.modelId,
      routeId: event.routeId ?? null,
      result,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      received: parsed.events.length,
      results,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
