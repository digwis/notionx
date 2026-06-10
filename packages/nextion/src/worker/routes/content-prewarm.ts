// worker/routes/content-prewarm.ts
//
// POST /api/content/prewarm - 预热内容搜索索引
//
// The route logic itself is generic. The actual prewarm work lives in
// a caller-supplied function (`prewarmPublicContentSearchIndex`) so
// that the package does not reach into the starter's content models.
// The starter wires its implementation in via
// `createContentPrewarmRoute`; the Cloudflare Workers bootstrap
// (Task 5.3) wires its own implementation.

import { NextResponse } from "next/server";

export type PrewarmResultShape = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  models: Array<{
    modelId: string;
    ok: boolean;
    total: number;
    indexed: number;
    skipped: boolean;
    error?: string;
  }>;
};

export type PrewarmFn = (options?: {
  models?: readonly string[];
}) => Promise<PrewarmResultShape>;

export type AuthorizeRevalidateFn = (
  request: Request,
  token?: string | null
) => boolean;

export type CreateContentPrewarmRouteOptions = {
  authorizeContentRevalidate: AuthorizeRevalidateFn;
  prewarmPublicContentSearchIndex: PrewarmFn;
  getVerificationToken: () => Promise<string | null | undefined>;
};

export function createContentPrewarmRoute(
  options: CreateContentPrewarmRouteOptions
) {
  return {
    async POST(request: Request) {
      const token = await options.getVerificationToken();
      if (!options.authorizeContentRevalidate(request, token)) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        );
      }

      const result = await options.prewarmPublicContentSearchIndex({
        models: readRequestedModels(request),
      });

      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    },
    async handle(request: Request): Promise<Response> {
      if (request.method !== "POST") {
        return NextResponse.json(
          { ok: false, error: "Method not allowed" },
          { status: 405, headers: { "Cache-Control": "no-store" } }
        );
      }
      return this.POST(request);
    },
  };
}

function readRequestedModels(request: Request) {
  const url = new URL(request.url);
  return url.searchParams
    .getAll("model")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}
