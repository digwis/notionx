// Public surface for the @nextion/core/storage/routes subpath.
//
// Each entry exposes a route object with both a Next.js-friendly
// `GET`/`POST` handler and a worker-friendly `handle` function. The
// top-level `GET` and `*RouteHandle` aliases provide a flat import
// surface for callers that prefer that style.
export { filesRoute, GET as GET_files, filesRouteHandle } from "./files";
export { cdnRoute, GET as GET_cdn, cdnRouteHandle } from "./cdn";
