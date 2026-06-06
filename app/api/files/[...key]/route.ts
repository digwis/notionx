// GET /api/files/[...key] - 从 R2 取文件并代理返回
// 不公开 bucket，避免任何人都能列文件

import { NextResponse } from "next/server";
import { workerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ key: string[] }>;
};

function decodeKey(parts: string[]): string {
  return decodeURIComponent(parts.join("/"));
}

export async function GET(_request: Request, { params }: Props) {
  const { key } = await params;
  const decoded = decodeKey(key);

  if (decoded.includes("..") || decoded.startsWith("/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const env = workerEnv;
  if (!env.ASSETS_BUCKET) {
    return NextResponse.json(
      { error: "R2 not configured" },
      { status: 503 }
    );
  }

  const object = await env.ASSETS_BUCKET.get(decoded);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set("Content-Type", object.httpMetadata.contentType);
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (object.etag) headers.set("ETag", object.etag);
  headers.set("Content-Length", String(object.size));

  return new Response(object.body, { headers });
}
