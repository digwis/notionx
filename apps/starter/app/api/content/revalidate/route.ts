import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  authorizeContentRevalidate,
  readContentRevalidateRequest,
  readContentRevalidateRequestFromUrl,
  revalidateContentModel,
} from "@/lib/content/revalidate";
import { getNotionWebhookVerificationToken } from "@/lib/notion/config";
import { getRuntimePlatform } from "@/lib/platform/current";

export const dynamic = "force-dynamic";

async function revalidate(request: Request, body: Awaited<ReturnType<typeof readContentRevalidateRequest>>) {
  const token = await getNotionWebhookVerificationToken().catch(() => null);
  const authorized = authorizeContentRevalidate(request, token);
  const result = await revalidateContentModel({
    request: body,
    tokenAuthorized: authorized,
    revalidatePath,
    getDatabase: () => getRuntimePlatform().database,
    getContentCache: () => getRuntimePlatform().keyValueCache,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      modelId: result.model.id,
      routeId: result.routeId,
      revalidatedPaths: result.revalidatedPaths,
      contentCache: result.contentCache,
      searchIndex: result.searchIndex,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  return revalidate(request, await readContentRevalidateRequest(request));
}

export async function GET(request: Request) {
  return revalidate(
    request,
    readContentRevalidateRequestFromUrl(new URL(request.url))
  );
}
