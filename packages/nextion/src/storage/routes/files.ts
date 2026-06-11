// storage/routes/files.ts
//
// GET /api/files/[...key] - 从对象存储取文件并代理返回
// 不公开 bucket/container，避免任何人都能列文件
//
// The package exports a route object with two surfaces:
//   - `GET` is the Next.js handler signature (request, { params }).
//   - `handle` is a single `(request) => Response` form used by the
//     Cloudflare Workers bootstrap in `@notionx/core/worker`.
//
// The bodies are identical; only the way the object key is read differs.

import { NextResponse } from "next/server";
import { getRuntimePlatform } from "../../platform/current";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ key: string[] }>;
};

export const filesRoute = {
  /**
   * Next.js handler for `app/api/files/[...key]/route.ts`. Receives the
   * catch-all key from the route params.
   */
  async GET(_request: Request, props: Props) {
    const { key } = await props.params;
    return filesRoute.handle(new Request(buildInternalUrl(_request, key)));
  },
  /**
   * Worker-friendly handler. Extracts the catch-all key from the URL
   * pathname (`/api/files/<key>`).
   */
  async handle(request: Request): Promise<Response> {
    const key = readKeyFromUrl(request.url);
    if (!key) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    if (key.includes("..") || key.startsWith("/")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const storage = getRuntimePlatform().objectStorage;
    if (!storage) {
      return NextResponse.json(
        { error: "Object storage not configured" },
        { status: 503 }
      );
    }

    const object = await storage.get(key);
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
  },
};

/**
 * Worker-friendly single-arg handler. Used by the Cloudflare Workers
 * bootstrap in `@notionx/core/worker`. Equivalent to
 * `filesRoute.handle`.
 */
export async function filesRouteHandle(request: Request): Promise<Response> {
  return filesRoute.handle(request);
}

function buildInternalUrl(request: Request, keyParts: string[]) {
  const url = new URL(request.url);
  url.pathname = `/api/files/${keyParts.map(encodeURIComponent).join("/")}`;
  return url.toString();
}

function readKeyFromUrl(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  const prefix = "/api/files/";
  if (!url.pathname.startsWith(prefix)) return null;
  const encoded = url.pathname.slice(prefix.length);
  if (!encoded) return null;
  return decodeURIComponent(encoded);
}

// Re-export as top-level function aliases for callers that prefer a
// flat signature (e.g. the Next.js app/api/.../route.ts delegates).
export const GET = filesRoute.GET;
