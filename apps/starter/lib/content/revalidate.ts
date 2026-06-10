import { expandLocalizedMoviePaths } from "../i18n/config.ts";
import { getPublishedTranslationPathsForMovieRouteId } from "../notion/movie-localized.ts";
import type { ContentModelDefinition } from "./model.ts";
import { getContentModel, type ContentModelId } from "./models.ts";
import {
  deleteSearchIndexDocument,
  deleteSearchIndexForModel,
} from "./search-index.ts";
import { deleteNotionContentCache } from "../notion/content-cache.ts";
import type {
  KeyValueCacheAdapter,
  SqlDatabaseAdapter,
} from "../platform/runtime.ts";

type RevalidatePathFn = (
  path: string,
  type?: "page" | "layout"
) => void | Promise<void>;

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

export type ContentRevalidateResult =
  | {
      ok: true;
      model: Pick<ContentModelDefinition, "id" | "routes">;
      routeId?: string;
      revalidatedPaths: string[];
      contentCache: NotionContentCacheInvalidationResult;
      searchIndex: SearchIndexInvalidationResult;
    }
  | {
      ok: false;
      status: 400 | 401 | 404;
      error: string;
    };

export type SearchIndexInvalidationResult = {
  ok: boolean;
  skipped: boolean;
  deleted: string[];
  failed: Array<{ routeId?: string; error: string }>;
};

export type NotionContentCacheInvalidationResult = {
  ok: boolean;
  skipped: boolean;
  deleted: string[];
  failed: Array<{ key?: string; error: string }>;
};

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
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function shouldLocalizeMoviePaths(modelId: string) {
  return modelId === "movies" || modelId === "movie-translations";
}

export function buildContentRevalidationPaths(input: {
  model: Pick<ContentModelDefinition, "id" | "routes">;
  routeId?: string;
  previousRouteId?: string;
  locale?: string;
  includeApi?: boolean;
  localizedMovieDetailPaths?: readonly string[];
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
  if (input.localizedMovieDetailPaths?.length) {
    pagePaths.push(...input.localizedMovieDetailPaths);
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

  const localizedPagePaths = shouldLocalizeMoviePaths(input.model.id)
    ? expandLocalizedMoviePaths(pagePaths, input.locale)
    : pagePaths;

  return {
    pagePaths: Array.from(new Set(localizedPagePaths)),
    routePaths: Array.from(new Set(routePaths)),
    all: Array.from(new Set([...localizedPagePaths, ...routePaths])),
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

export async function revalidateContentModel(input: {
  request: ContentRevalidateRequest | null;
  tokenAuthorized: boolean;
  revalidatePath: RevalidatePathFn;
  contentCache?: KeyValueCacheAdapter;
  getContentCache?: () => KeyValueCacheAdapter | null;
  database?: SqlDatabaseAdapter;
  getDatabase?: () => SqlDatabaseAdapter | null;
}): Promise<ContentRevalidateResult> {
  if (!input.tokenAuthorized) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!input.request?.modelId) {
    return { ok: false, status: 400, error: "modelId is required" };
  }
  const model = getContentModel(input.request.modelId as ContentModelId);
  if (!model) {
    return {
      ok: false,
      status: 404,
      error: `Unknown content model: ${input.request.modelId}`,
    };
  }

  const localizedMovieDetailPaths =
    model.id === "movies" && input.request.routeId
      ? await getPublishedTranslationPathsForMovieRouteId(input.request.routeId)
      : [];

  const paths = buildContentRevalidationPaths({
    model,
    routeId: input.request.routeId,
    previousRouteId: input.request.previousRouteId,
    locale: input.request.locale,
    includeApi: input.request.includeApi,
    localizedMovieDetailPaths,
  });

  await Promise.all([
    ...paths.pagePaths.map((path) => input.revalidatePath(path, "page")),
    ...paths.routePaths.map((path) => input.revalidatePath(path)),
  ]);

  const contentCache = await deleteNotionContentCache({
    modelId: model.id,
    pageId: input.request.pageId,
    routeId: input.request.routeId,
    previousRouteId: input.request.previousRouteId,
    cache: input.contentCache,
    getCache: input.getContentCache,
  });
  const searchIndex = await invalidateContentModelSearchIndex(
    {
      modelId: model.id,
      routeId: input.request.routeId,
      previousRouteId: input.request.previousRouteId,
      kind: input.request.kind ?? "update",
      includeApi: input.request.includeApi,
    },
    {
      database: input.database,
      getDatabase: input.getDatabase,
    }
  );

  return {
    ok: true,
    model,
    routeId: input.request.routeId,
    revalidatedPaths: paths.all,
    contentCache,
    searchIndex,
  };
}

type ContentModelInvalidationInput = {
  modelId: ContentModelId | string;
  routeId?: string;
  previousRouteId?: string;
  kind: InvalidationKind;
  includeApi?: boolean;
};

async function invalidateContentModelSearchIndex(
  input: ContentModelInvalidationInput,
  options: {
    database?: SqlDatabaseAdapter;
    getDatabase?: () => SqlDatabaseAdapter | null;
  } = {}
): Promise<SearchIndexInvalidationResult> {
  let database: SqlDatabaseAdapter | null;
  try {
    if (options.database) {
      database = options.database;
    } else if (options.getDatabase) {
      database = options.getDatabase();
    } else {
      database = null;
    }
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      deleted: [],
      failed: [
        {
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  if (!database) {
    return {
      ok: true,
      skipped: true,
      deleted: [],
      failed: [],
    };
  }

  const routeIds = Array.from(
    new Set([input.routeId, input.previousRouteId].filter(Boolean) as string[])
  );
  const deleted: string[] = [];
  const failed: Array<{ routeId?: string; error: string }> = [];

  try {
    if (routeIds.length === 0) {
      await deleteSearchIndexForModel(database, { modelId: input.modelId });
      deleted.push(`${input.modelId}:*`);
    } else {
      for (const routeId of routeIds) {
        await deleteSearchIndexDocument(database, {
          modelId: input.modelId,
          routeId,
        });
        deleted.push(`${input.modelId}:${routeId}`);
      }
    }
  } catch (error) {
    failed.push({
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    ok: failed.length === 0,
    skipped: false,
    deleted,
    failed,
  };
}

export function previewContentModelInvalidation(input: ContentRevalidateRequest) {
  const model = getContentModel(input.modelId as ContentModelId);
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
