// worker/routes/content-revalidate.ts
//
// GET/POST /api/content/revalidate - 触发内容模型缓存失效
//
// The route logic itself is generic. The actual revalidation work
// lives in caller-supplied functions so that the package does not
// reach into the starter's content model registry. The starter wires
// its implementation in via `createContentRevalidateRoute`; the
// Cloudflare Workers bootstrap (Task 5.3) wires its own
// implementation when it constructs the worker.

import { NextResponse } from "next/server";

import type { KeyValueCacheAdapter, SqlDatabaseAdapter } from "../../platform/runtime";

export type ContentRevalidateRequestShape = {
  modelId: string;
  pageId?: string;
  routeId?: string;
  previousRouteId?: string;
  locale?: string;
  kind?: "publish" | "update" | "delete";
  includeApi?: boolean;
};

export type ContentRevalidateResultShape =
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
    };

export type AuthorizeRevalidateFn = (
  request: Request,
  token?: string | null
) => boolean;

export type ReadRevalidateRequestFn = (
  request: Request
) => Promise<ContentRevalidateRequestShape | null>;

export type ReadRevalidateRequestFromUrlFn = (
  url: URL
) => ContentRevalidateRequestShape | null;

export type RevalidateContentModelFn = (input: {
  request: ContentRevalidateRequestShape | null;
  tokenAuthorized: boolean;
  revalidatePath: (
    path: string,
    type?: "page" | "layout"
  ) => void | Promise<void>;
  contentCache?: KeyValueCacheAdapter;
  getContentCache?: () => KeyValueCacheAdapter | null;
  database?: SqlDatabaseAdapter;
  getDatabase?: () => SqlDatabaseAdapter | null;
}) => Promise<ContentRevalidateResultShape>;

export type CreateContentRevalidateRouteOptions = {
  revalidatePath: (
    path: string,
    type?: "page" | "layout"
  ) => void | Promise<void>;
  authorizeContentRevalidate: AuthorizeRevalidateFn;
  readContentRevalidateRequest: ReadRevalidateRequestFn;
  readContentRevalidateRequestFromUrl: ReadRevalidateRequestFromUrlFn;
  revalidateContentModel: RevalidateContentModelFn;
  getVerificationToken: () => Promise<string | null | undefined>;
  getDatabase: () => SqlDatabaseAdapter | null;
  getContentCache: () => KeyValueCacheAdapter | null;
};

export function createContentRevalidateRoute(
  options: CreateContentRevalidateRouteOptions
) {
  async function revalidate(
    request: Request,
    body: ContentRevalidateRequestShape | null
  ) {
    const token = await options.getVerificationToken().catch(() => null);
    const authorized = options.authorizeContentRevalidate(request, token);
    const result = await options.revalidateContentModel({
      request: body,
      tokenAuthorized: authorized,
      revalidatePath: options.revalidatePath,
      contentCache: options.getContentCache() ?? undefined,
      getContentCache: options.getContentCache,
      database: options.getDatabase() ?? undefined,
      getDatabase: options.getDatabase,
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

  return {
    async POST(request: Request) {
      return revalidate(
        request,
        await options.readContentRevalidateRequest(request)
      );
    },
    async GET(request: Request) {
      return revalidate(
        request,
        options.readContentRevalidateRequestFromUrl(new URL(request.url))
      );
    },
    async handle(request: Request): Promise<Response> {
      if (request.method === "POST") {
        return revalidate(
          request,
          await options.readContentRevalidateRequest(request)
        );
      }
      return revalidate(
        request,
        options.readContentRevalidateRequestFromUrl(new URL(request.url))
      );
    },
  };
}
