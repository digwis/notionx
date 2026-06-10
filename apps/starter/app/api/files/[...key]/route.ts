// GET /api/files/[...key] - 从对象存储取文件并代理返回
// 不公开 bucket/container，避免任何人都能列文件

import { NextResponse } from "next/server";
import { getRuntimePlatform } from "@/lib/platform/current";

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

  const storage = getRuntimePlatform().objectStorage;
  if (!storage) {
    return NextResponse.json(
      { error: "Object storage not configured" },
      { status: 503 }
    );
  }

  const object = await storage.get(decoded);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers();
  if (object.contentType) {
    headers.set("Content-Type", object.contentType);
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (object.etag) headers.set("ETag", object.etag);
  headers.set("Content-Length", String(object.size));

  return new Response(object.body, { headers });
}
