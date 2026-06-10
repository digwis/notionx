// apps/moviebluebook/lib/content/revalidate.ts
//
// Re-exports the foundation's generic content revalidation helpers
// and provides the project-specific `revalidateContentModel`
// implementation. The implementation glues the foundation's helpers
// together with the starter's localized movie translation resolver
// and Notion content cache.
import type {
  KeyValueCacheAdapter,
  SqlDatabaseAdapter,
} from "@vinext/foundation/platform";
import {
  buildContentRevalidationPaths as foundationBuildContentRevalidationPaths,
  type ContentRevalidateRequest,
  type RevalidatePathFn,
} from "@vinext/foundation/content";
import { getPublishedTranslationPathsForMovieRouteId } from "../notion/movie-localized.ts";
import {
  deleteSearchIndexDocument,
  deleteSearchIndexForModel,
  type SearchIndexInvalidationResult,
} from "./search-index.ts";
import {
  deleteNotionContentCache as starterDeleteNotionContentCache,
  type NotionContentCacheInvalidationResult,
} from "../notion/content-cache.ts";
import { getContentModel, type ContentModelId } from "./models.ts";

export {
  authorizeContentRevalidate,
  buildContentRevalidationPaths,
  readContentRevalidateRequest,
  readContentRevalidateRequestFromUrl,
  previewContentModelInvalidation,
  type ContentRevalidateRequest,
  type InvalidationKind,
  type RevalidatePathFn,
} from "@vinext/foundation/content";

export type { SearchIndexInvalidationResult } from "./search-index.ts";
export type { NotionContentCacheInvalidationResult } from "../notion/content-cache.ts";

export type ContentRevalidateResult =
  | {
      ok: true;
      model: { id: string; routes: { listPath: string; detailPath: string; publicApiPath?: string } };
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

type InvalidationKind = "publish" | "update" | "delete";

async function invalidateContentModelSearchIndex(
  input: {
    modelId: ContentModelId | string;
    routeId?: string;
    previousRouteId?: string;
    kind: InvalidationKind;
    includeApi?: boolean;
  },
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
    new Set(
      [input.routeId, input.previousRouteId].filter(Boolean) as string[]
    )
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

  const paths = foundationBuildContentRevalidationPaths({
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

  const contentCache = await starterDeleteNotionContentCache({
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
      kind: (input.request.kind ?? "update") as InvalidationKind,
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
