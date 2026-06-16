// packages/nextion/src/content/revalidate.ts
//
// Generic content revalidation helpers. Projects can layer domain-specific
// path expansion (for example localized routes) through `expandPagePaths`.
//
// This file is the single authoritative source for the revalidate
// request/result/function types. `notion/` and `worker/` (higher
// tiers) import from here instead of duplicating the shapes.

import type { ContentModelDefinition } from "./models";
import { getRegisteredSource } from "./models";
import type {
  KeyValueCacheAdapter,
  SqlDatabaseAdapter,
} from "../platform/runtime";

type RevalidatePathFn = (
  path: string,
  type?: "page" | "layout"
) => void | Promise<void>;

export type { RevalidatePathFn };

export type InvalidationKind = "publish" | "update" | "delete";

export type ContentRevalidateRequest = {
  modelId: string;
  pageId?: string;
  routeId?: string;
  previousRouteId?: string;
  locale?: string;
  kind?: InvalidationKind;
  includeApi?: boolean;
};

/**
 * Result of a revalidation call. The `ok: true` branch carries the
 * model descriptor, expanded paths, and opaque cache/search snapshots
 * for logging. The `ok: false` branch carries an HTTP-ish status and
 * a human-readable error.
 */
export type ContentRevalidateResult =
  | {
      ok: true;
      model: {
        id: string;
        routes: {
          listPath: string;
          detailPath: string;
          publicApiPath?: string;
        };
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

/**
 * Caller-supplied revalidation implementation. The package's route
 * factories (`createContentRevalidateRoute`, `createNotionWebhookRoute`)
 * accept this shape so the package never reaches into the starter's
 * content model registry.
 */
export type RevalidateContentModelFn = (input: {
  request: ContentRevalidateRequest | null;
  tokenAuthorized: boolean;
  revalidatePath: RevalidatePathFn;
  contentCache?: KeyValueCacheAdapter;
  getContentCache?: () => KeyValueCacheAdapter | null;
  database?: SqlDatabaseAdapter;
  getDatabase?: () => SqlDatabaseAdapter | null;
}) => Promise<ContentRevalidateResult>;

function asObject(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function readString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

function readKind(input: Record<string, unknown>): InvalidationKind {
  const value = readString(input, "kind");
  if (value === "publish" || value === "delete" || value === "update") {
    return value;
  }
  return "update";
}

function detailPathForRouteId(detailPath: string, routeId: string) {
  return detailPath.replace(/\[[^\]]+\]/g, routeId);
}

function publicApiDetailPathForRouteId(publicApiPath: string, routeId: string) {
  return `${publicApiPath.replace(/\/+$/, "")}/${routeId.replace(/^\/+/, "")}`;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function timingSafeEqualString(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) return false;

  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

export function buildContentRevalidationPaths(input: {
  model: Pick<ContentModelDefinition, "id" | "routes">;
  routeId?: string;
  previousRouteId?: string;
  locale?: string;
  includeApi?: boolean;
  extraPagePaths?: readonly string[];
  expandPagePaths?: (paths: readonly string[], locale?: string) => readonly string[];
}) {
  const pagePaths = [input.model.routes.listPath];
  const routePaths: string[] = [];

  if (input.routeId) {
    pagePaths.push(
      detailPathForRouteId(input.model.routes.detailPath, input.routeId)
    );
  }
  if (input.previousRouteId) {
    pagePaths.push(
      detailPathForRouteId(
        input.model.routes.detailPath,
        input.previousRouteId
      )
    );
  }
  if (input.extraPagePaths?.length) {
    pagePaths.push(...input.extraPagePaths);
  }
  if (input.includeApi !== false && input.model.routes.publicApiPath) {
    routePaths.push(input.model.routes.publicApiPath);
    if (input.routeId) {
      routePaths.push(
        publicApiDetailPathForRouteId(
          input.model.routes.publicApiPath,
          input.routeId
        )
      );
    }
    if (input.previousRouteId) {
      routePaths.push(
        publicApiDetailPathForRouteId(
          input.model.routes.publicApiPath,
          input.previousRouteId
        )
      );
    }
  }

  const expandedPagePaths = input.expandPagePaths
    ? input.expandPagePaths(pagePaths, input.locale)
    : pagePaths;

  return {
    pagePaths: Array.from(new Set(expandedPagePaths)),
    routePaths: Array.from(new Set(routePaths)),
    all: Array.from(new Set([...expandedPagePaths, ...routePaths])),
  };
}

export function authorizeContentRevalidate(
  request: Request,
  token?: string | null
) {
  const expected = String(token ?? "").trim();
  if (!expected) return false;
  const actual = bearerToken(request);
  return Boolean(actual && timingSafeEqualString(actual, expected));
}

export async function readContentRevalidateRequest(
  request: Request
): Promise<ContentRevalidateRequest | null> {
  const body = asObject(await request.json().catch(() => null));
  if (!body) return null;

  const modelId = readString(body, "modelId");
  const pageId = readString(body, "pageId");
  const routeId = readString(body, "routeId");
  const previousRouteId = readString(body, "previousRouteId");
  const locale = readString(body, "locale");

  return {
    modelId,
    pageId: pageId || undefined,
    routeId: routeId || undefined,
    previousRouteId: previousRouteId || undefined,
    locale: locale || undefined,
    kind: readKind(body),
    includeApi: body.includeApi !== false,
  };
}

export function readContentRevalidateRequestFromUrl(
  url: URL
): ContentRevalidateRequest | null {
  const modelId = url.searchParams.get("modelId")?.trim() ?? "";
  if (!modelId) return null;

  const kind = url.searchParams.get("kind")?.trim() ?? "";
  const includeApi = url.searchParams.get("includeApi");
  return {
    modelId,
    pageId: url.searchParams.get("pageId")?.trim() || undefined,
    routeId: url.searchParams.get("routeId")?.trim() || undefined,
    previousRouteId:
      url.searchParams.get("previousRouteId")?.trim() || undefined,
    locale: url.searchParams.get("locale")?.trim() || undefined,
    kind:
      kind === "publish" || kind === "delete" || kind === "update"
        ? kind
        : "update",
    includeApi: includeApi !== "false",
  };
}

export function previewContentModelInvalidation(input: ContentRevalidateRequest) {
  const model = getRegisteredSource(input.modelId);
  if (!model) {
    throw new Error(`Unknown content model: ${input.modelId}`);
  }

  return buildContentRevalidationPaths({
    model,
    routeId: input.routeId,
    previousRouteId: input.previousRouteId,
    includeApi: input.includeApi,
  });
}
