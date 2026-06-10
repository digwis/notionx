import { NextResponse } from "next/server";
import {
  authorizeContentRevalidate,
} from "@/lib/content/revalidate";
import { prewarmPublicContentSearchIndex } from "@/lib/content/prewarm";
import { getNotionWebhookVerificationToken } from "@/lib/notion/config";

export const dynamic = "force-dynamic";

function readRequestedModels(request: Request) {
  const url = new URL(request.url);
  return url.searchParams
    .getAll("model")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const token = await getNotionWebhookVerificationToken();
  if (!authorizeContentRevalidate(request, token)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const result = await prewarmPublicContentSearchIndex({
    models: readRequestedModels(request),
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
