import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { revalidateContentModel } from "@/lib/content/revalidate";
import { getNotionWebhookVerificationToken } from "@/lib/notion/config";
import {
  getStoredNotionWebhookVerificationToken,
  notionWebhookEventToRevalidateRequest,
  parseNotionWebhookPayloadWithPageLookup,
  putStoredNotionWebhookVerificationToken,
  verifyNotionWebhookSignatureWithTokens,
} from "@/lib/notion/webhook";
import { getRuntimePlatform } from "@/lib/platform/current";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const parsed = await parseNotionWebhookPayloadWithPageLookup(payload, {
    lookupPages: false,
  });

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

  const token = await getNotionWebhookVerificationToken();
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

  const resolved = await parseNotionWebhookPayloadWithPageLookup(payload);
  if (resolved.type === "verification") {
    return NextResponse.json(
      { ok: false, error: "Unexpected verification payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const results = [];
  for (const event of resolved.events) {
    const result = await revalidateContentModel({
      request: notionWebhookEventToRevalidateRequest(event),
      tokenAuthorized: true,
      revalidatePath,
      getDatabase: () => getRuntimePlatform().database,
      getContentCache: () => getRuntimePlatform().keyValueCache,
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
