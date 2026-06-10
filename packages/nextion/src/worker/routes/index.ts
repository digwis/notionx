// Public surface for the @nextion/core/worker/routes subpath.
//
// The health route is a fully self-contained handler. The content
// revalidate and prewarm routes are factory functions that take the
// content model's revalidation logic as a parameter — the package
// does not reach into the starter's content model registry.
export { healthRoute, healthRouteHandle } from "./health";
export { createContentRevalidateRoute } from "./content-revalidate";
export type {
  ContentRevalidateRequestShape,
  ContentRevalidateResultShape,
  AuthorizeRevalidateFn,
  ReadRevalidateRequestFn,
  ReadRevalidateRequestFromUrlFn,
  RevalidateContentModelFn,
  CreateContentRevalidateRouteOptions,
} from "./content-revalidate";
export { createContentPrewarmRoute } from "./content-prewarm";
export type {
  PrewarmResultShape,
  PrewarmFn,
  CreateContentPrewarmRouteOptions,
} from "./content-prewarm";
