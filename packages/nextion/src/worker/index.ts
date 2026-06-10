// Public surface for the @nextion/core/worker subpath.
//
// Re-exports the Cloudflare Worker bootstrap plus the supporting
// types the starter's `worker/index.ts` needs to construct one.

export {
  createNextionWorker,
  healthRoute,
  healthRouteHandle,
  type FoundationExtraRouteHandler,
  type FoundationWorker,
  type FoundationWorkerOptions,
} from "./bootstrap";
