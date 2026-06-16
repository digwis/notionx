// Foundation Cloudflare Worker bootstrap.
//
// Wires the package's first-party worker routes (health, storage,
// notion media) plus any project-injected `extraRoutes` into a single
// `fetch` handler. The handler returns `Response | null` so the
// starter wrapper can fall through to vinext for any request
// foundation does not own.
//
// Contract:
//   - `fetch(request, env, ctx)` returns a `Response` when a route
//     matched (or when the admin gate fires), and `null` to signal
//     "not handled" so the caller can delegate to the underlying
//     app router / vinext handler.
//
// Tier restriction: this file lives in `src/worker/`, so it CANNOT
// import from `src/auth/` or `src/admin/`. The session/admin gate
// lives in the tier-7 `middleware.ts` module which the bootstrap
// delegates to.

import { notionxMiddleware, type NotionxMiddlewareOptions } from "../middleware";
import type {
  AdminNavItem,
  AuthConfig,
  ContentSource,
} from "../types";
import type { SearchAdapter } from "../search/adapter";
import { filesRoute } from "../storage/routes/files";
import { cdnRoute } from "../storage/routes/cdn";
import { notionMediaRoute } from "../media/routes/notion-media";
import { healthRoute, healthRouteHandle } from "./routes/health";
import { createSearchRouteHandler } from "./routes/search";

/**
 * Public surface for the bootstrap options. Mirrors the placeholder
 * `WorkerOptions` type in `src/types.ts`; Phase 6 normalizes the
 * shape once the content abstraction lands.
 */
export interface FoundationWorkerOptions {
  sources: ContentSource[];
  adminNav: AdminNavItem[];
  /**
   * Auth configuration. When omitted (e.g. the project was
   * scaffolded with `--no-auth`), the worker runs without auth —
   * no session cookies, no admin gate, no viewer resolution.
   */
  authConfig?: AuthConfig;
  /**
   * Placeholder for the future site config. Kept on the options
   * surface so consumers can wire it today; the bootstrap itself
   * does not yet consume it.
   */
  siteConfig: {
    name: string;
    description: string;
    defaultLocale: string;
    locales: string[];
    navigation: unknown[];
  };
  /**
   * Optional session resolver passed straight through to
   * `notionxMiddleware`. When omitted the middleware still runs
   * the admin gate but always reports no viewer.
   */
  sessionLookup?: NotionxMiddlewareOptions["sessionLookup"];
  /**
   * Search adapter. When present, the worker registers `/api/search`
   * automatically. Omit when the project was scaffolded with
   * `--no-search` or after `notionx remove search`.
   */
  searchAdapter?: SearchAdapter;
  /**
   * Project-injected routes. Each entry maps a pathname to a
   * dynamic loader. The loader returns a module whose `default`
   * export is a `(request, options) => Promise<Response>` handler.
   *
   * Loaders are invoked lazily on the first matching request so
   * the route module can pull in heavy dependencies (e.g. the
   * starter's content models) only when needed.
   */
  extraRoutes?: Record<
    string,
    () => Promise<{ default: FoundationExtraRouteHandler }>
  >;
}

export type FoundationExtraRouteHandler = (
  request: Request,
  options: FoundationWorkerOptions,
  sources: ContentSource[],
  auth: { databaseBinding: string }
) => Promise<Response>;

export interface FoundationWorker {
  /**
   * Worker-style fetch. Returns `Response` when foundation handled
   * the request, `null` to let the caller fall through to vinext.
   */
  fetch: (
    request: Request,
    env: unknown,
    ctx: unknown
  ) => Promise<Response | null>;
}

interface RouteEntry {
  match: (request: Request) => boolean;
  handle: (request: Request) => Promise<Response>;
}

function pathMatches(pathname: string, match: string): boolean {
  if (match.endsWith("/")) return pathname.startsWith(match);
  return pathname === match || pathname.startsWith(`${match}/`);
}

function buildStaticRoutes(): RouteEntry[] {
  return [
    {
      match: (req) => new URL(req.url).pathname === "/api/health",
      handle: healthRouteHandle,
    },
    {
      match: (req) =>
        pathMatches(new URL(req.url).pathname, "/api/notion/media/"),
      handle: notionMediaRoute.handle,
    },
    {
      match: (req) =>
        pathMatches(new URL(req.url).pathname, "/api/files/"),
      handle: filesRoute.handle,
    },
    {
      match: (req) =>
        pathMatches(new URL(req.url).pathname, "/api/cdn/"),
      handle: cdnRoute.handle,
    },
  ];
}

/**
 * Build a foundation Cloudflare Worker.
 *
 * The returned object exposes a `fetch` method that:
 *   1. Runs `notionxMiddleware` (admin gate + viewer attachment).
 *   2. Tries the first-party route table.
 *   3. Tries any project-injected `extraRoutes`.
 *   4. Returns `null` if nothing matched, so the starter wrapper can
 *      delegate to vinext.
 */
export function createNotionxWorker(
  options: FoundationWorkerOptions
): FoundationWorker {
  const sources: ContentSource[] = options.sources;
  const auth = options.authConfig
    ? { databaseBinding: options.authConfig.databaseBinding }
    : { databaseBinding: "DB" };

  const routes: RouteEntry[] = buildStaticRoutes();

  // Register the search route only when a SearchAdapter is provided.
  // This keeps `/api/search` absent in projects scaffolded with
  // `--no-search` or after `notionx remove search`.
  if (options.searchAdapter) {
    const handleSearch = createSearchRouteHandler({
      adapter: options.searchAdapter,
    });
    routes.push({
      match: (req) => new URL(req.url).pathname === "/api/search",
      handle: handleSearch,
    });
  }

  if (options.extraRoutes) {
    for (const [path, load] of Object.entries(options.extraRoutes)) {
      const modPromise = load();
      routes.push({
        match: (req) => new URL(req.url).pathname === path,
        handle: async (req) => {
          const mod = await modPromise;
          return mod.default(req, options, sources, auth);
        },
      });
    }
  }

  const middlewareOptions: NotionxMiddlewareOptions = {
    authConfig: options.authConfig,
    sessionLookup: options.sessionLookup,
  };

  return {
    async fetch(request, env, ctx) {
      void ctx;

      // 1. Admin gate. A 401 short-circuits the route table.
      const gateResponse = await notionxMiddleware(
        request,
        env,
        middlewareOptions
      );
      if (gateResponse) return gateResponse;

      // 2. First-party + extra routes.
      for (const route of routes) {
        if (route.match(request)) return route.handle(request);
      }

      // 3. Not handled. The caller falls through to vinext.
      return null;
    },
  };
}

// Re-export the health route shape so consumers can build their own
// worker if they need finer control than the bootstrap offers.
export { healthRoute, healthRouteHandle };
